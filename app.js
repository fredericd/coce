const express = require('express');
const { logger } = require('./lib/logger');
const coce = require('./coce');
const { validateIds, validateProviders } = require('./lib/validation');

const app = express();

// Generate unique request IDs
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  req.requestId = generateRequestId();
  req.startTime = startTime;
  
  // Create child logger with request context
  req.logger = logger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url
  });

  req.logger.info('Incoming request', {
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    query: req.query
  });

  // Override res.send to log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    return originalSend.call(this, data);
  };

  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  const requestLogger = req.logger || logger;
  requestLogger.error('Unhandled application error', err, {
    requestId: req.requestId,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  req.logger.debug('Health check requested');
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    service: 'coce',
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // MB
    },
    config: {
      providers: coce.config.providers,
      timeout: coce.config.timeout,
      port: coce.config.port
    }
  };

  // Add PM2 instance information if running under PM2
  if (process.env.pm_id) {
    healthData.pm2 = {
      instanceId: process.env.pm_id,
      clusterId: process.env.NODE_APP_INSTANCE || 0
    };
  }

  // Log health check for monitoring systems
  logger.logHealthCheck('healthy', {
    memory: healthData.memory,
    uptime: healthData.uptime
  });

  res.json(healthData);
});

// Metrics endpoint for monitoring systems
app.get('/metrics', (req, res) => {
  req.logger.debug('Metrics requested');
  
  const metrics = {
    timestamp: Date.now(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    service: {
      name: 'coce',
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    }
  };

  logger.logMetrics(metrics);
  res.json(metrics);
});

// Root endpoint
app.get('/', (req, res) => {
  req.logger.debug('Root endpoint requested');
  res.send('Welcome to coce');
});

const validateCallback = (callback, logger) => {
  if (!callback) {
    return { valid: true };
  }
  
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    logger.warn('Invalid callback parameter', { callback });
    return { 
      valid: false, 
      error: 'Invalid callback parameter - must be a valid JavaScript identifier' 
    };
  }
  
  logger.debug('Callback validation successful', { callback });
  return { valid: true };
};

// Main cover endpoint
app.get('/cover', (req, res) => {
  const requestLogger = req.logger;
  
  try {
    requestLogger.info('Cover request started', { query: req.query });
    
    // Validate IDs
    const idValidation = validateIds(req.query.id);
    if (!idValidation.valid) {
      requestLogger.warn('ID validation failed', { 
        providedId: req.query.id, 
        error: idValidation.error 
      });
      return res.status(400).json({
        error: idValidation.error,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const ids = idValidation.ids;
    requestLogger.debug('ID validation successful', { ids, count: ids.length });
    
    // Validate providers
    const providerValidation = validateProviders(req.query.provider, coce.config.providers);
    if (!providerValidation.valid) {
      requestLogger.warn('Provider validation failed', { 
        providedProviders: req.query.provider, 
        error: providerValidation.error 
      });
      return res.status(400).json({
        error: providerValidation.error,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    const providers = providerValidation.providers;
    requestLogger.debug('Provider validation successful', { providers });
    const { callback } = req.query;
    const includeAll = req.query.all !== undefined;
    
    // Validate callback parameter for JSONP
    const callbackValidation = validateCallback(callback, requestLogger);
    if (!callbackValidation.valid) {
      return res.status(400).json({
        error: callbackValidation.error,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    requestLogger.info('Starting cover fetch', {
      ids,
      providers,
      includeAll,
      hasCallback: !!callback
    });
    
    const fetcher = new coce.CoceFetcher();
    
    // Set up timeout for the entire request
    const requestTimeout = setTimeout(() => {
      if (!res.headersSent) {
        requestLogger.error('Request timeout exceeded', null, { 
          timeout: coce.config.timeout,
          ids,
          providers
        });
        res.status(504).json({
          error: 'Request timeout - external services took too long to respond',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
      }
    }, coce.config.timeout + 1000);
    
    fetcher.fetch(ids, providers, (result) => {
      clearTimeout(requestTimeout);
      
      if (res.headersSent) {
        requestLogger.warn('Response already sent, ignoring fetch result');
        return;
      }
      
      try {
        // Handle fetch errors
        if (result.error !== undefined) {
          requestLogger.error('Fetch operation failed', null, { 
            error: result.error,
            ids,
            providers 
          });
          return res.status(400).json({
            error: result.error,
            requestId: req.requestId,
            timestamp: new Date().toISOString()
          });
        }
        
        let responseData = result;
        
        // Process response based on 'all' parameter
        if (!includeAll) {
          responseData = {};
          Object.keys(result).forEach((id) => {
            const urlPerProvider = result[id];
            const firstProvider = providers.find((provider) => urlPerProvider[provider] !== undefined);
            if (firstProvider !== undefined) {
              responseData[id] = urlPerProvider[firstProvider];
            }
          });
        }
        
        // Log successful response
        const foundCount = Object.keys(responseData).length;
        const totalUrls = includeAll ? 
          Object.values(responseData).reduce((sum, urls) => sum + Object.keys(urls).length, 0) :
          foundCount;
          
        requestLogger.info('Cover request completed successfully', {
          requestedIds: ids.length,
          foundIds: foundCount,
          totalUrls,
          providers,
          includeAll
        });
        
        // Handle JSONP callback
        if (callback) {
          res.contentType('application/javascript');
          const jsonpResponse = `${callback}(${JSON.stringify(responseData)})`;
          res.send(jsonpResponse);
        } else {
          res.contentType('application/json');
          res.json(responseData);
        }
        
      } catch (error) {
        requestLogger.error('Error processing fetch result', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Error processing results',
            requestId: req.requestId,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
    
  } catch (error) {
    requestLogger.error('Unexpected error in cover endpoint', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Set endpoint
app.get('/set', (req, res) => {
  const requestLogger = req.logger;
  
  try {
    const { provider, id, url } = req.query;
    
    requestLogger.info('Manual URL set requested', { provider, id, url });
    
    // Validate required parameters
    if (!provider || !id || !url) {
      requestLogger.warn('Missing parameters for set endpoint', { 
        provider: !!provider,
        id: !!id,
        url: !!url 
      });
      return res.status(400).json({
        error: 'Missing required parameters: provider, id, and url are all required',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate provider
    if (!coce.config.providers.includes(provider)) {
      requestLogger.warn('Invalid provider for set endpoint', { 
        provider,
        availableProviders: coce.config.providers 
      });
      return res.status(400).json({
        error: `Invalid provider: ${provider}. Available: ${coce.config.providers.join(', ')}`,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Basic URL validation
    try {
      new URL(url);
    } catch (urlError) {
      requestLogger.warn('Invalid URL for set endpoint', { url, error: urlError.message });
      return res.status(400).json({
        error: 'Invalid URL format',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    coce.set(provider, id, url);
    
    requestLogger.info('URL set successfully', { provider, id, url });
    
    res.json({
      success: true,
      provider,
      id,
      url,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    requestLogger.error('Error in set endpoint', error);
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  const requestLogger = req.logger || logger;
  requestLogger.warn('Route not found', { 
    url: req.url, 
    method: req.method
  });
  res.status(404).json({
    error: 'Route not found',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Only start server if not in test environment
if (require.main === module) {
  const server = app.listen(coce.config.port, (err) => {
    if (err) {
      logger.error('Failed to start server', err, { port: coce.config.port });
      process.exit(1);
    }
    
    logger.info('Coce server started successfully', { 
      port: coce.config.port,
      providers: coce.config.providers,
      timeout: coce.config.timeout,
      nodeVersion: process.version,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development'
    });
  });

  server.on('error', (error) => {
    logger.error('Server error', error);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle process signals for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', reason, { promise: promise.toString() });
    process.exit(1);
  });
}

// Export app for testing
module.exports = app;
