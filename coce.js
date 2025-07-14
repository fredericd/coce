/* eslint-disable no-undef */
/* eslint-disable no-eval */
const fs = require('fs');
const http = require('http');
const https = require('https');
const { logger } = require('./lib/logger');

// Safe config loading with error handling
let config;
try {
  const configPath = process.env.CONFIG_PATH || 'config.json';
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
  logger.info('Configuration loaded successfully', { 
    configPath,
    providers: config.providers,
    port: config.port
  });
} catch (error) {
  logger.error('Failed to load configuration', error, { 
    configPath: process.env.CONFIG_PATH || 'config.json'
  });
  process.exit(1);
}

exports.config = config;

const redis = require('redis').createClient(config.redis.port, config.redis.host);

// Redis error handling
redis.on('error', (error) => {
  logger.error('Redis connection error', error, { 
    host: config.redis.host, 
    port: config.redis.port 
  });
});

redis.on('connect', () => {
  logger.info('Redis connected successfully', { 
    host: config.redis.host, 
    port: config.redis.port 
  });
});

redis.on('reconnecting', () => {
  logger.warn('Redis reconnecting', { 
    host: config.redis.host, 
    port: config.redis.port 
  });
});

/**
 * CoceFetcher class
 *
 * @class CoceFetcher
 * @module coce
 * @constructor
 * @param {int} timeout Timeout in miliseconds. After this delay, the fetching
 * is aborted, even if some providers haven't yet responded. Without param, the
 * timeout is retrieved from config.json file.
 */
const CoceFetcher = function CoceFetcher(timeout) {
  this.timeout = timeout === undefined ? config.timeout : timeout;
  this.count = 0;
  this.finished = false;

  /**
   * URLs found in the cache (or from providers)
   * @property url
   * @type Object
   */
  this.url = {};
};
exports.CoceFetcher = CoceFetcher;

CoceFetcher.RegGb = new RegExp('(zoom=5)', 'g');

/**
 * Retrieve an ID from Amazon. Cover image direct URL are tested.
 * @method aws_http
 * @param {Array} ids The resource IDs to request to Amazon
 */
CoceFetcher.prototype.aws = function awsFetcher(ids) {
  const repo = this;
  const providerName = 'aws';
  
  logger.info('Starting Amazon AWS provider fetch', { 
    provider: providerName,
    ids, 
    count: ids.length 
  });

  let i = 0;
  const checkoneurl = () => {
    const id = ids[i];
    let search = id;
    
    // If ISBN13, transform it into ISBN10
    search = search.replace(/-/g, '');
    if (search.length === 13) {
      // Remove the 978 prefix and get the first 9 digits
      search = search.substr(3, 9);
      
      // Calculate ISBN10 checksum using the correct algorithm
      let checksum = 0;
      for (let j = 0; j < 9; j++) {
        checksum += parseInt(search[j], 10) * (10 - j);
      }
      checksum = (11 - (checksum % 11)) % 11;
      checksum = checksum === 10 ? 'X' : checksum.toString();
      search += checksum;
      
      logger.debug('ISBN13 to ISBN10 conversion', { 
        provider: providerName,
        original: id,
        converted: search,
        checksum
      });
    }
    
    const opts = {
      hostname: 'images-na.ssl-images-amazon.com',
      method: 'HEAD',
      headers: { 'user-agent': 'Mozilla/5.0' },
      path: `/images/P/${search}.01.MZZZZZZZZZ.jpg`,
    };
    
    const req = https.get(opts, (res) => {
      const url = `https://${opts.hostname}${opts.path}`;
      
      logger.debug('Amazon AWS response received', { 
        provider: providerName,
        id,
        statusCode: res.statusCode,
        url
      });
      
      if (res.statusCode === 200 || res.statusCode === 403) {
        repo.addurl('aws', id, url);
        logger.debug('Amazon AWS cover found', { 
          provider: providerName,
          id, 
          url,
          statusCode: res.statusCode
        });
      } else {
        logger.debug('Amazon AWS cover not found', { 
          provider: providerName,
          id,
          statusCode: res.statusCode
        });
      }
      
      repo.increment();
      i += 1;
      
      // timeout for next request
      if (i < ids.length) {
        setTimeout(checkoneurl, 30);
      } else {
        logger.info('Amazon AWS fetch completed', { 
          provider: providerName,
          processed: ids.length
        });
      }
    });

    req.on('error', (error) => {
      logger.error('Amazon AWS request failed', error, { 
        provider: providerName,
        id,
        url: `https://${opts.hostname}${opts.path}`
      });
      repo.increment();
      i += 1;
      if (i < ids.length) setTimeout(checkoneurl, 30);
    });

    req.on('timeout', () => {
      logger.warn('Amazon AWS request timeout', { 
        provider: providerName,
        id,
        timeout: config.aws.timeout || 'default'
      });
      req.destroy();
      repo.increment();
      i += 1;
      if (i < ids.length) setTimeout(checkoneurl, 30);
    });

    // Set timeout if configured
    if (config.aws && config.aws.timeout) {
      req.setTimeout(config.aws.timeout);
    }
  };
  
  checkoneurl();
};

/**
 * Retrieve an ID from Google Books
 * @method gb
 * @param {Array} ids The resource IDs to request to Google Books
 */
CoceFetcher.prototype.gb = function gb(ids) {
  const repo = this;
  const providerName = 'gb';
  
  logger.info('Starting Google Books provider fetch', { 
    provider: providerName,
    ids, 
    count: ids.length 
  });

  const opts = {
    host: 'books.google.com',
    port: 443,
    path: `/books?bibkeys=${ids.join(',')}&jscmd=viewapi&amp;hl=en`,
  };
  
  const req = https.get(opts, (res) => {
    logger.debug('Google Books response received', { 
      provider: providerName,
      statusCode: res.statusCode,
      headers: res.headers 
    });
    
    res.setEncoding('utf8');
    let store = '';
    
    res.on('data', (data) => { 
      store += data; 
    });
    
    res.on('end', () => {
      try {
        // Safe evaluation with error handling
        let _GBSBookInfo = {};
        
        // Validate response before eval
        if (!store || store.trim().length === 0) {
          logger.warn('Empty response from Google Books', { provider: providerName, ids });
          repo.increment(ids.length);
          return;
        }
        
        // Safe eval with try-catch
        try {
          eval(store);
        } catch (evalError) {
          logger.error('Failed to evaluate Google Books response', evalError, { 
            provider: providerName,
            responseLength: store.length,
            responsePreview: store.substring(0, 200)
          });
          repo.increment(ids.length);
          return;
        }
        
        if (typeof _GBSBookInfo === 'object' && _GBSBookInfo !== null) {
          let foundCount = 0;
          Object.values(_GBSBookInfo).forEach((item) => {
            try {
              const id = item.bib_key;
              let url = item.thumbnail_url;
              if (url === undefined) return;
              
              // get the medium size cover image
              url = url.replace(CoceFetcher.RegGb, 'zoom=1');
              repo.addurl(providerName, id, url);
              foundCount++;
              
              logger.debug('Google Books cover found', { 
                provider: providerName,
                id, 
                url 
              });
            } catch (itemError) {
              logger.error('Error processing Google Books item', itemError, { 
                provider: providerName,
                item 
              });
            }
          });
          
          logger.info('Google Books fetch completed', { 
            provider: providerName,
            requested: ids.length,
            found: foundCount
          });
        } else {
          logger.warn('Invalid Google Books response format', { 
            provider: providerName,
            responseType: typeof _GBSBookInfo
          });
        }
        
        repo.increment(ids.length);
        
      } catch (error) {
        logger.error('Error parsing Google Books response', error, { 
          provider: providerName,
          responseLength: store.length 
        });
        repo.increment(ids.length);
      }
    });

    res.on('error', (error) => {
      logger.error('Google Books response stream error', error, { 
        provider: providerName,
        ids 
      });
      repo.increment(ids.length);
    });
  });

  req.on('error', (error) => {
    logger.error('Google Books request failed', error, { 
      provider: providerName,
      ids,
      host: opts.host,
      path: opts.path
    });
    repo.increment(ids.length);
  });

  req.on('timeout', () => {
    logger.warn('Google Books request timeout', { 
      provider: providerName,
      ids,
      timeout: config.gb.timeout || 'default'
    });
    req.destroy();
    repo.increment(ids.length);
  });

  // Set timeout if configured
  if (config.gb && config.gb.timeout) {
    req.setTimeout(config.gb.timeout);
  }
};


/**
 * Retrieve an ID from ORB
 * @method orb
 * @param {Array} ids The resource IDs to request to ORB
 */
 CoceFetcher.prototype.orb = function orb(ids) {
  const repo = this;
  const providerName = 'orb';
  
  logger.info('Starting ORB provider fetch', { 
    provider: providerName,
    ids, 
    count: ids.length 
  });

  if (!config.orb || !config.orb.user || !config.orb.key) {
    logger.error('ORB configuration missing', null, { 
      provider: providerName,
      hasConfig: !!config.orb,
      hasUser: !!(config.orb && config.orb.user),
      hasKey: !!(config.orb && config.orb.key)
    });
    repo.increment(ids.length);
    return;
  }

  const opts = {
    host: 'api.base-orb.fr',
    auth: `${config.orb.user}:${config.orb.key}`,
    port: 443,
    path: `/v1/products?eans=${ids.join(',')}&sort=ean_asc`,
  };
  
  const req = https.get(opts, (res) => {
    logger.debug('ORB response received', { 
      provider: providerName,
      statusCode: res.statusCode,
      headers: res.headers 
    });
    
    res.setEncoding('utf8');
    let store = '';
    
    res.on('data', (data) => { 
      store += data; 
    });
    
    res.on('end', () => {
      try {
        // Validate response before parsing
        if (!store || store.trim().length === 0) {
          logger.warn('Empty response from ORB', { provider: providerName, ids });
          repo.increment(ids.length);
          return;
        }
        
        // Safe JSON parsing with try-catch
        let orbres;
        try {
          orbres = JSON.parse(store);
        } catch (parseError) {
          logger.error('Failed to parse ORB JSON response', parseError, { 
            provider: providerName,
            responseLength: store.length,
            responsePreview: store.substring(0, 200)
          });
          repo.increment(ids.length);
          return;
        }
        
        if (orbres && orbres.data && Array.isArray(orbres.data)) {
          let foundCount = 0;
          orbres.data.forEach((item) => {
            try {
              const id = item.ean13;
              const url = item.images && 
                         item.images.front && 
                         item.images.front.thumbnail && 
                         item.images.front.thumbnail.src;
              
              if (url === undefined) return;
              
              repo.addurl(providerName, id, url);
              foundCount++;
              
              logger.debug('ORB cover found', { 
                provider: providerName,
                id, 
                url 
              });
            } catch (itemError) {
              logger.error('Error processing ORB item', itemError, { 
                provider: providerName,
                item 
              });
            }
          });
          
          logger.info('ORB fetch completed', { 
            provider: providerName,
            requested: ids.length,
            found: foundCount
          });
        } else {
          logger.warn('Invalid ORB response format', { 
            provider: providerName,
            hasData: !!(orbres && orbres.data),
            isArray: !!(orbres && orbres.data && Array.isArray(orbres.data))
          });
        }
        
        repo.increment(ids.length);
        
      } catch (error) {
        logger.error('Error processing ORB response', error, { 
          provider: providerName,
          responseLength: store.length,
          statusCode: res.statusCode
        });
        repo.increment(ids.length);
      }
    });

    res.on('error', (error) => {
      logger.error('ORB response stream error', error, { 
        provider: providerName,
        ids 
      });
      repo.increment(ids.length);
    });
  });

  req.on('error', (error) => {
    logger.error('ORB request failed', error, { 
      provider: providerName,
      ids,
      host: opts.host,
      path: opts.path
    });
    repo.increment(ids.length);
  });

  req.on('timeout', () => {
    logger.warn('ORB request timeout', { 
      provider: providerName,
      ids,
      timeout: config.orb.timeout || 'default'
    });
    req.destroy();
    repo.increment(ids.length);
  });

  // Set timeout if configured
  if (config.orb && config.orb.timeout) {
    req.setTimeout(config.orb.timeout);
  }
};


/**
 * Retrieve an ID from Open Library
 * @method ol
 * @param {Array} ids The resource IDs to request to Open Library
 */
CoceFetcher.prototype.ol = function ol(ids) {
  const repo = this;
  const opts = {
    host: 'openlibrary.org',
    port: 80,
    path: `/api/books?bibkeys=${ids.join(',')}&jscmd=data`,
  };
  const req = http.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => { store += data; });
    res.on('end', () => {
      try {
        eval(store);
        Object.keys(_OLBookInfo).forEach((id) => {
          let url = _OLBookInfo[id].cover;
          if (url === undefined) return;
          url = url[config.ol.imageSize];
          repo.addurl('ol', id, url);
        });
      } catch (error) {
        logger.error('Failed to parse Open Library response', {
          provider: 'ol',
          responseLength: store.length,
          responsePreview: store.substring(0, 100),
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          process: {
            pid: process.pid,
            memory: process.memoryUsage().rss,
            uptime: Math.floor(process.uptime())
          }
        });
      }
      repo.increment(ids.length);
    });
  });
  
  req.on('error', (error) => {
    logger.error('Open Library request failed', {
      provider: 'ol',
      ids: ids,
      host: opts.host,
      path: opts.path,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage().rss,
        uptime: Math.floor(process.uptime())
      }
    });
    repo.increment(ids.length);
  });
};

/**
 * Add an url to redis
 * Cache locally a file if necessary
 */
CoceFetcher.prototype.addurl = function addurl(provider, id, url) {
  let storedUrl;
  if (config[provider].cache) {
    storedUrl = `${config.cache.url}/${provider}/${id}.jpg`;
    const dest = `${config.cache.path}/${provider}/${id}.jpg`;
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => file.close());
    }).on('error', () => fs.unlink(dest));
  } else {
    storedUrl = url;
  }
  redis.setex(`${provider}.${id}`, config[provider].timeout, storedUrl);
  if (this.url[id] === undefined) this.url[id] = {};
  this.url[id][provider] = storedUrl;
};

/**
 * Increment the count of found URLs.
 * Stop the timer if all URLs have been found.
 * @param {int} increment Increment the number of found IDs. No parameter = 1.
 */
CoceFetcher.prototype.increment = function incr(increment = 1) {
  this.count += increment;
  if (this.count >= this.countMax) {
    clearTimeout(this.timeoutId);
    if (!this.finished) {
      this.finished = true;
      this.finish(this.url);
    }
  }
};

/**
 * Retrieve IDs from a provider
 * @method add
 * @param {Array} ids Group of IDs
 * @param {String} provider (aws|gb|ol) to search for
 */
CoceFetcher.prototype.add = function add(ids, provider) {
  const repo = this;
  const notcached = [];
  let count = ids.length;
  let timeoutId;
  for (let i = 0; i < ids.length; i += 1) {
    // eslint-disable-next-line no-loop-func
    (function addId() {
      const id = ids[i];
      const key = `${provider}.${ids[i]}`;
      redis.get(key, (err, reply) => {
        count -= 1;
        if (reply === null) {
          // Not in the cache
          notcached.push(id);
          redis.setex(`${provider}.${id}`, config[provider].timeout, '');
        } else if (reply === '') {
          // In the cache, but no url via provider
          repo.increment();
        } else {
          if (repo.url[id] === undefined) repo.url[id] = {};
          repo.url[id][provider] = reply;
          repo.increment();
        }
        if (count === 0 && timeoutId !== undefined) {
          // We get all responses from Redis
          clearTimeout(timeoutId);
          if (notcached.length > 0) repo[provider](notcached);
        }
      });
    }());
  }
  // Wait all Redis responses
  timeoutId = setTimeout(() => {
    if (notcached.length > 0) repo[provider](notcached);
  }, config.redis.timeout);
};

/**
 * Fetch all provided ID from cover image providers
 * Wait for providers reponses, with a limitation of time
 * @method fetch
 * @param {Array} ids Array of images ID
 * @param {Array} providers Array of images providers (gb, aws, ol)
 * @param timeout {int} Max duration of the fetching
 * @param finish {Function} Function to execute when all URLs are fetched or time has
 * elasped
 */
CoceFetcher.prototype.fetch = function fetch(ids, providers, finish) {
  logger.info('Starting fetch operation', { 
    ids, 
    providers, 
    idsCount: ids ? ids.length : 0,
    providersCount: providers ? providers.length : 0
  });

  // Validate providers parameter with proper null/undefined check FIRST
  if (!providers || !Array.isArray(providers) || providers.length === 0) {
    const error = 'At least, one provider is required';
    logger.error('Fetch validation failed', null, { 
      error,
      providedProviders: providers,
      availableProviders: config.providers
    });
    finish({ error });
    return;
  }

  this.count = 0;
  this.countMax = ids.length * providers.length;
  this.finish = finish;
  this.finished = false;
  this.url = {};

  // Validate that all providers are available
  for (let i = 0; i < providers.length; i += 1) {
    let provider = providers[i];
    if (config.providers.indexOf(provider) === -1) {
      const error = `Unavailable provider: ${provider}`;
      logger.error('Invalid provider specified', null, { 
        error,
        provider,
        availableProviders: config.providers
      });
      finish({ error });
      return;
    }
  }

  // Start provider operations
  for (let i = 0; i < providers.length; i += 1) {
    try {
      logger.debug('Starting provider operation', { provider: providers[i], ids });
      this.add(ids, providers[i]);
    } catch (error) {
      logger.error('Provider operation failed', error, { provider: providers[i], ids });
      // Continue with other providers
    }
  }

  if (this.count !== this.countMax) {
    const repo = this;
    this.timeoutId = setTimeout(() => {
      if (!repo.finished) {
        logger.warn('Fetch operation timeout', { 
          ids,
          providers,
          timeout: repo.timeout,
          completed: repo.count,
          expected: repo.countMax
        });
        
        repo.finished = true;
        
        logger.info('Fetch operation completed with timeout', { 
          ids,
          providers,
          foundIds: Object.keys(repo.url).length,
          totalUrls: Object.values(repo.url).reduce((sum, urls) => 
            sum + (typeof urls === 'object' ? Object.keys(urls).length : 1), 0)
        });
        
        repo.finish(repo.url);
      }
    }, this.timeout);
  }
};

exports.set = function setex(provider, id, url) {
  redis.setex(`aws.${id}`, 315360000, url);
};
