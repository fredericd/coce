const fs = require('fs');
const path = require('path');

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
    this.logFile = options.logFile;
    
    // Log level hierarchy
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.currentLevel = this.levels[this.level] || this.levels.info;
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

    // Add error details if provided
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      };
    }

    // Add process info for errors
    if (level === 'error') {
      logEntry.process = {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      };
    }

    const logString = JSON.stringify(logEntry);

    // Output to console
    if (level === 'error') {
      console.error(logString);
    } else if (level === 'warn') {
      console.warn(logString);
    } else {
      console.log(logString);
    }

    // Write to file if configured
    if (this.logFile) {
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
        query: req.query,
        headers: {
          'content-type': req.get('Content-Type'),
          'accept': req.get('Accept')
        }
      },
      response: {
        statusCode: res.statusCode,
        headers: {
          'content-type': res.get('Content-Type')
        }
      }
    };

    if (duration !== null) {
      meta.response.duration = duration;
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
      ids: Array.isArray(ids) ? ids : [ids],
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
        key,
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
