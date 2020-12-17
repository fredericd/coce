var fs = require('fs');
var http = require('http');
var https = require('https');
var util = require('util');


var config = eval('('+fs.readFileSync('config.json','utf8')+')');
exports.config = config;

var redis = require('redis').createClient(config.redis.port, config.redis.host);


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
var CoceFetcher = function(timeout) {
  if (timeout === undefined) timeout = config.timeout;
  this.timeout = timeout;
  this.ids;
  this.providers;
  this.count = 0;
  this.timeoutId;
  this.finish;
  this.finished = false;

  /**
   * URLs found in the cache (or from providers)
   * @property url
   * @type Object
   */
  this.url = {};
}
exports.CoceFetcher = CoceFetcher;


CoceFetcher.RegGb = new RegExp("(zoom=5)", "g");



/**
 * Retrieve an ID from Amazon. Cover image direct URL are tested.
 * @method aws_http
 * @param {Array} ids The resource IDs to request to Amazon
 */
CoceFetcher.prototype.aws = function(ids) {
  const repo = this;
  let i = 0;
  let checkoneurl;
  checkoneurl = () => {
    const id = ids[i];
    let search = id;
    // If ISBN13, transform it into ISBN10
    search = search.replace(/-/g, '');
    if (search.length == 13) {
      search = search.substr(3,9);
      // Calculate checksum
      var checksum = search.split('').reduce(function(s, c, i) {
        return s + parseInt(c) * (i+1);
      }, 0);
      checksum %= 11;
      checksum = checksum == 10 ? 'X' : checksum;
      search += checksum;
    }
    const opts = {
      hostname: 'images-na.ssl-images-amazon.com',
      method: 'HEAD',
      headers: {'user-agent': 'Mozilla/5.0'},
      path: '/images/P/' + search + '.01.MZZZZZZZZZ.jpg',
    };
    https.get(opts, (res) => {
      const url = 'https://' + opts.hostname + opts.path;
      if (res.statusCode == 200 || res.statusCode == 403) repo.addurl('aws', id, url);
      repo.increment();
      i++;
      // timeout for next request
      if (i < ids.length) setTimeout(checkoneurl, 30);
    })
  }
  checkoneurl();
};


/**
 * Retrieve an ID from Google Books
 * @method gb
 * @param {Array} ids The resource IDs to request to Google Books
 */
CoceFetcher.prototype.gb = function(ids) {
  const repo = this;
  const opts = {
    host: 'books.google.com',
    port: 443,
    path: "/books?bibkeys=" + ids.join(',') + "&jscmd=viewapi&amp;hl=en",
  };
  https.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => store += data);
    res.on('end', () => {
      eval(store);
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
 * Retrieve an ID from Open Library
 * @method ol
 * @param {Array} ids The resource IDs to request to Open Library
 */
CoceFetcher.prototype.ol = function(ids) {
  const repo = this;
  const opts = {
    host: 'openlibrary.org',
    port: 80,
    path: "/api/books?bibkeys=" + ids.join(',') + "&jscmd=data",
  };
  http.get(opts, (res) => {
    res.setEncoding('utf8');
    let store = '';
    res.on('data', (data) => store += data );
    res.on('end', () => {
      eval(store);
      for (var id in _OLBookInfo) {
        var url = _OLBookInfo[id].cover;
        if (url === undefined) continue;
        url = url[config.ol.imageSize];
        repo.addurl('ol', id, url);
      }
      repo.increment(ids.length);
    });
  });
};


/**
 * Add an url to redis
 * @param {int} increment Increment the number of found IDs. No parameter = 1.
 */
CoceFetcher.prototype.addurl = function(provider, id, url) {
  redis.setex(`${provider}.${id}`, config[provider].timeout, url);
  if (this.url[id] === undefined) this.url[id] = {};
  this.url[id][provider] = url;
};



/**
 * Increment the count of found URLs.
 * Stop the timer if all URLs have been found.
 * @param {int} increment Increment the number of found IDs. No parameter = 1.
 */
CoceFetcher.prototype.increment = function(increment) {
  if (increment === undefined) increment = 1;
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
CoceFetcher.prototype.add = function(ids, provider) {
  var repo = this;
  var notcached = [];
  var count = ids.length;
  var timeoutId;
  for (var i=0; i < ids.length; i++) {
    (function(){
      var id = ids[i];
      var key = provider + '.' + ids[i];
      redis.get(key, function(err, reply) {
        count--;
        if ( reply === null ) {
          // Not in the cache
          notcached.push(id);
          redis.setex(provider+'.'+id, config[provider].timeout, '');
        } else if ( reply === '' ) {
          // In the cache, but no url via provider
          repo.increment();
        } else {
          if (repo.url[id] === undefined) repo.url[id] = {};
          repo.url[id][provider] = reply;
          repo.increment();
        }
        if (count == 0 && timeoutId !== undefined) {
          // We get all responses from Redis
          clearTimeout(timeoutId);
          //console.log("Redis: all responses received. notcached="+notcached.length)
          if (notcached.length > 0) repo[provider](notcached);
        }
      })
    }())
   }
   // Wait all Redis responses
   timeoutId = setTimeout(function(){
     if (notcached.length > 0) repo[provider](notcached);
   }, config.redis.timeout);
};


/**
 * Fetch all provided ID from cover image providers
 * Wait for providers reponses, with a limitation of time
 * @method fetch
 * @param {Array} ids Array of images ID
 * @param {Array} providers Array of images providers (gb, aws, ol)
 * @param timeout {int} Max duration of the fetching
 * @param finish {Function} Function to execute when all URLs are fetched or time has
 * elasped
 */
CoceFetcher.prototype.fetch = function(ids, providers, finish) {
  this.count = 0;
  this.countMax = ids.length * providers.length;
  this.timeoutId;
  this.finish = finish;
  this.finished = false;
  this.url = {};

  // Validate providers
  for (var i=0; provider = providers[i]; i++)
    if (config.providers.indexOf(provider) == -1)
      throw new Error('Unavailable provider: ' + provider);

  for (var i=0; provider = providers[i]; i++)
    this.add(ids, provider);
  if (this.count !== this.countMax) {
    var repo = this;
    this.timeoutId = setTimeout(function() {
      if (!repo.finished) {
        repo.finished = true;
        repo.finish(repo.url);
      }
    }, this.timeout);
  }
};
