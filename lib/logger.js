const fs = require('fs');

/**
 * Structured Logger Class
 * Implements standard log levels with JSON output for easy parsing
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.service = options.service || 'coce';
    this.version = options.version || process.env.npm_package_version || 'unknown';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.logFile = options.logFile || process.env.LOG_FILE;
    
    // PM2 instance information
    this.instanceId = process.env.INSTANCE_ID || process.env.pm_id || 0;
    this.clusterId = process.env.NODE_APP_INSTANCE || 0;
    
    // Log level hierarchy
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.currentLevel = this.levels[this.level] || this.levels.info;
    
    // Disable file logging if PM2 is managing logs
    this.pm2Managed = process.env.pm_id !== undefined;
    if (this.pm2Managed && !this.logFile) {
      this.logFile = null;
    }
  }

  /**
   * Core logging method
   */
  log(level, message, meta = {}, error = null) {
    if (this.levels[level] > this.currentLevel) {
      return; // Skip if below current log level
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      version: this.version,
      environment: this.environment,
      message,
      ...meta
    };

    // Add PM2 cluster information when running under PM2
    if (this.pm2Managed) {
      logEntry.pm2 = {
        instanceId: this.instanceId,
        clusterId: this.clusterId,
        pid: process.pid
      };
    }

    // Add error details if provided
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        code: error.code,
        // Include full stack trace in development, first line only in production
        stack: this.environment === 'development' ? error.stack : error.stack?.split('\n')[0]
      };
    }

    // Add process info for errors
    if (level === 'error') {
      logEntry.process = {
        pid: process.pid,
        memory: process.memoryUsage().rss, // RSS memory in bytes
        uptime: Math.floor(process.uptime())
      };
    }

    const logString = JSON.stringify(logEntry);

    // Output to console (PM2 will capture this)
    if (level === 'error') {
      console.error(logString);
    } else if (level === 'warn') {
      console.warn(logString);
    } else {
      console.log(logString);
    }

    // Write to file if configured and not managed by PM2
    if (this.logFile && !this.pm2Managed) {
      try {
        fs.appendFileSync(this.logFile, logString + '\n');
      } catch (fileError) {
        console.error('Failed to write to log file:', fileError.message);
      }
    }
  }

  /**
   * Error level logging
   */
  error(message, error = null, meta = {}) {
    this.log('error', message, meta, error);
  }

  /**
   * Warning level logging
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Info level logging
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Debug level logging
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Trace level logging
   */
  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  /**
   * HTTP request logging helper
   */
  logRequest(req, res, duration = null) {
    const meta = {
      request: {
        id: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        // Only log query params in development to avoid logging sensitive data
        ...(this.environment === 'development' && { query: req.query })
      },
      response: {
        statusCode: res.statusCode,
        ...(duration !== null && { duration })
      }
    };

    // Flag slow requests for monitoring
    if (duration && duration > 1000) {
      meta.performance = { slow: true, threshold: 1000 };
    }

    if (res.statusCode >= 400) {
      this.warn('HTTP request completed with error', meta);
    } else {
      this.info('HTTP request completed', meta);
    }
  }

  /**
   * Provider operation logging helper
   */
  logProviderOperation(provider, operation, ids, result = null, error = null) {
    const meta = {
      provider,
      operation,
      count: Array.isArray(ids) ? ids.length : 1
    };

    if (result) {
      meta.result = {
        found: Object.keys(result).length,
        urls: Object.values(result).reduce((sum, urls) => 
          sum + (typeof urls === 'object' ? Object.keys(urls).length : 1), 0)
      };
    }

    if (error) {
      this.error(`Provider ${provider} ${operation} failed`, error, meta);
    } else {
      this.info(`Provider ${provider} ${operation} completed`, meta);
    }
  }

  /**
   * Cache operation logging helper
   */
  logCacheOperation(operation, key, hit = null, error = null) {
    const meta = {
      cache: {
        operation,
        key: typeof key === 'string' ? key.substring(0, 50) : key, // Truncate long keys
        hit
      }
    };

    if (error) {
      this.error(`Cache ${operation} failed`, error, meta);
    } else {
      this.debug(`Cache ${operation}`, meta);
    }
  }

  /**
   * Health check logging for monitoring systems
   */
  logHealthCheck(status, metrics = {}) {
    this.info('Health check', {
      health: {
        status,
        ...metrics,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Performance metrics logging for monitoring systems
   */
  logMetrics(metrics) {
    this.info('Performance metrics', {
      metrics: {
        ...metrics,
        timestamp: Date.now(),
        instance: this.instanceId
      }
    });
  }

  /**
   * Create child logger with additional context
   */
  child(additionalMeta = {}) {
    const childLogger = new Logger({
      level: this.level,
      service: this.service,
      version: this.version,
      environment: this.environment,
      logFile: this.logFile
    });
    
    // Override log method to include additional meta
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, meta = {}, error = null) => {
      return originalLog(level, message, { ...additionalMeta, ...meta }, error);
    };
    
    return childLogger;
  }
}

// Create default logger instance
const logger = new Logger({
  service: 'coce',
  logFile: process.env.LOG_FILE
});

module.exports = { Logger, logger };
