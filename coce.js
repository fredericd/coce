/* eslint-disable no-undef */
/* eslint-disable no-eval */
const fs = require('fs');
const http = require('http');
const https = require('https');

const config = eval(`(${fs.readFileSync('config.json', 'utf8')})`);
exports.config = config;

const redis = require('redis').createClient(config.redis.port, config.redis.host);

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
  let i = 0;
  const checkoneurl = () => {
    const id = ids[i];
    let search = id;
    // If ISBN13, transform it into ISBN10
    search = search.replace(/-/g, '');
    if (search.length === 13) {
      search = search.substr(3, 9);
      // Calculate checksum
      let checksum = search.split('').reduce((s, c, ii) => s + parseInt(c, 10) * (ii + 1), 0);
      checksum %= 11;
      checksum = checksum === 10 ? 'X' : checksum;
      search += checksum;
    }
    const opts = {
      hostname: 'images-na.ssl-images-amazon.com',
      method: 'HEAD',
      headers: { 'user-agent': 'Mozilla/5.0' },
      path: `/images/P/${search}.01.MZZZZZZZZZ.jpg`,
    };
    https.get(opts, (res) => {
      const url = `https://${opts.hostname}${opts.path}`;
      if (res.statusCode === 200 || res.statusCode === 403) repo.addurl('aws', id, url);
      repo.increment();
      i += 1;
      // timeout for next request
      if (i < ids.length) setTimeout(checkoneurl, 30);
    });
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
  const opts = {
    host: 'books.google.com',
    port: 443,
    path: `/books?bibkeys=${ids.join(',')}&jscmd=viewapi&amp;hl=en`,
  };
  https.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => { store += data; });
    res.on('end', () => {
      eval(store);
      // eslint-disable-next-line no-undef
      Object.values(_GBSBookInfo).forEach((item) => {
        const id = item.bib_key;
        let url = item.thumbnail_url;
        if (url === undefined) return;
        // get the medium size cover image
        url = url.replace(CoceFetcher.RegGb, 'zoom=1');
        repo.addurl('gb', id, url);
      });
      repo.increment(ids.length);
    });
  });
};


/**
 * Retrieve an ID from ORB
 * @method orb
 * @param {Array} ids The resource IDs to request to ORB
 */
 CoceFetcher.prototype.orb = function orb(ids) {
  const repo = this;
  const opts = {
    host: 'api.base-orb.fr',
    auth: `${config.orb.user}:${config.orb.key}`,
    port: 443,
    path: `/v1/products?eans=${ids.join(',')}&sort=ean_asc`,
  };
  https.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => { store += data; });
    res.on('end', () => {
      const orbres = JSON.parse(store);
      Object.values(orbres.data).forEach((item) => {
        const id = item.ean13;
        const url = item.images.front.thumbnail.src;
        if (url === undefined) return;
        repo.addurl('orb', id, url);
      });
      repo.increment(ids.length);
    });
  });
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
  http.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => { store += data; });
    res.on('end', () => {
      eval(store);
      Object.keys(_OLBookInfo).forEach((id) => {
        let url = _OLBookInfo[id].cover;
        if (url === undefined) return;
        url = url[config.ol.imageSize];
        repo.addurl('ol', id, url);
      });
      repo.increment(ids.length);
    });
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
    saveresult = this.saveurl(url, dest);
    if (saveresult != 200) {
      storedUrl = url;
    }
  } else {
    storedUrl = url;
  }
  redis.setex(`${provider}.${id}`, config[provider].timeout, storedUrl);
  if (this.url[id] === undefined) this.url[id] = {};
  this.url[id][provider] = storedUrl;
};

/**
 * 
 * Get a copy of the file, following redirects as necessary.
 * Returns HTTP code 200 if successful.
 */
CoceFetcher.prototype.saveurl = function saveurl(url, dest) {
  var redirs = [url],
    fetch = function (url, dest) {
      https.get(url, (response) => {
        var body = [];
        if ([503].indexOf(response.statusCode) >= 0) {
          return 503;
        } else if ([301, 302].indexOf(response.statusCode) >= 0) {
          if (redirs.length > 10) {
            return 302; // Fail silently
          } else {
            if (redirs.indexOf(response.headers.location) < 0) {
              redirs.push(response.headers.location);
              return fetch(response.headers.location, dest);
            } else {
              return 500; // Redirect loop detected. Fail silently
            }
          }
        } else {
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => file.close());
          return 200;
        }
      });
    };
  return fetch(url, dest);
}

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
  this.count = 0;
  this.countMax = ids.length * providers.length;
  this.finish = finish;
  this.finished = false;
  this.url = {};

  // Validate providers
  if (providers === undefined) {
    finish({ error: 'At least, one provider is required' });
    return;
  }
  for (let i = 0; i < providers.length; i += 1) {
    provider = providers[i];
    if (config.providers.indexOf(provider) === -1) {
      finish({ error: `Unavailable provider: ${provider}` });
      return;
    }
  }

  for (let i = 0; i < providers.length; i += 1) this.add(ids, providers[i]);
  if (this.count !== this.countMax) {
    const repo = this;
    this.timeoutId = setTimeout(() => {
      if (!repo.finished) {
        repo.finished = true;
        repo.finish(repo.url);
      }
    }, this.timeout);
  }
};

exports.set = function setex(provider, id, url) {
  redis.setex(`aws.${id}`, 315360000, url);
};
