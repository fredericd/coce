var fs = require('fs');
var _redis = require('redis');
var redis = _redis.createClient();
var aws = require('aws-lib');
var express = require('express');
var http = require('http');
var app = express();
var util = require('util');

var config = eval('('+fs.readFileSync('config.json','utf8')+')');
var awsProdAdv = aws.createProdAdvClient(config.aws.accessKeyId,
      config.aws.secretAccessKey, config.aws.associateTag);

var regGb = new RegExp("(zoom=5)", "g");



/**
 * UrlRepo class
 *
 * @class UrlRepo
 * @module coce
 * @constructor
 * @param {Array} ids Array of images ID
 * @param {Array} providers Array of images providers (gb or aws)
 */
function UrlRepo(ids, providers) {
  this.ids = ids;
  this.providers = providers;
  this.count = 0;
  this.countMax = ids.length * providers.length;

  /**
   * URLs found in the cache (or from providers)
   * @property url
   * @type Object
   */
  this.url = {};
}


/**
 * Test if the repo contains all URLs for its IDs.
 * @method full
 * @return {Boolean}
 */
UrlRepo.prototype.full = function() {
  return this.count === this.countMax;
};


/**
 * Retrieve an ID from Google Books 
 * @method gb
 * @param {String} id The resource ID to request to Google Books
 */
UrlRepo.prototype.gb = function(id) {
  var repo = this;
  var key = 'gb.' + id;
  var opts = {
    host: 'books.google.com',
    port: 80,
    path: "/books?bibkeys=" + id + "&jscmd=viewapi",
  };
  var req = http.get(opts, function(res) {
    res.setEncoding('utf8');
    var store = '';
    res.on('data', function(data) { store += data });
    res.on('end', function() {
      //console.log(store);
      eval(store);
      //console.log(_GBSBookInfo);
      for (var id in _GBSBookInfo) {
        var url = _GBSBookInfo[id].thumbnail_url;
        if ( url === undefined ) { continue; }
        // get the medium size cover image
        url = url.replace(regGb, 'zoom=1');
        redis.setex(key, config.timeout, url);
        if (repo.url[id] === undefined) repo.url[id] = {};
        repo.url[id]['gb'] = url;
        console.log('----------------------');
        console.log(key +': ' + url);
        //console.log(util.inspect(repo, false, null));
      }
      repo.count++;
    });
  });
};


/**
 * Retrieve an ID from Amazon Product Advertising API
 * @method aws
 * @param {String} id The resource ID to request to Amazon
 */
UrlRepo.prototype.aws = function(id) {
  var repo = this;
  var options = { 
    SearchIndex: 'All',
    Keywords: id,
    ResponseGroup: 'Images'
  };
  awsProdAdv.call('ItemSearch', options, function(err, result) {
    //console.log(result.Items);
    var items = result.Items;
    if ( items.TotalResults > 0 ) {
      var item = items.Item;
      if (item instanceof Array) { item = item[0]; }
      //console.log(util.inspect(item, false, null));
      var url = item[config.aws.imageSize];
      if (url !== undefined) { // Amazon has a cover image
        var url = url.URL;
        redis.setex('aws.'+id, config.timeout, url);
        if (repo.url[id] === undefined) repo.url[id] = {};
        repo.url[id]['aws'] = url;
        //console.log('AWS added: ' + key + '=' + url);
        //console.log(util.inspect(repo, false, null));
      }
    }
    repo.count++;
  });
};


/**
 * Retrieve an ID from a provider
 * @method add
 * @param {String} id ID
 * @param {String} provider (aws|gb) to search for
 */
UrlRepo.prototype.add = function(id,provider) {
  var repo = this;
  var key = provider + '.' + id;
  console.log('GET ' + key);
  redis.get(key, function(err, reply) {
    console.log('GET result: ' + key + ' ' + reply);
    if ( reply === null ) {
      // Not in the cache => search
      redis.setex(key, config.timeout, '');
      if ( provider == 'gb' || provider == 'aws' )
        repo[provider](id);
      else
        repo.count++;
    } else if ( reply === '' ) {
        // In the cache, but not url via provider
        console.log('  => url in redis NO URL');
        repo.count++;
    } else {
      console.log('  => url in redis URL');
      //console.log( repo.url);
      if (repo.url[id] === undefined) repo.url[id] = {};
      repo.url[id][provider] = reply;
      repo.count++;
    } 
  });
};


/**
 * Fetch all provided ID from cover image providers
 * @method fetch
 */
UrlRepo.prototype.fetch = function() {
    for (var i=0; id = this.ids[i]; i++)
        for (var j=0; provider = this.providers[j]; j++)
            this.add(id, provider);
};


/**
 * Wait until URLs providers have finished responding or when too many time 
 * @method waitFetching
 * @param tick {int} Tick count for the timeout loop
 * @param timeout {int} Timeout duration
 * @param finish {Function} Function to execute when all URLs are fetched or time has
 * elasped
 */
UrlRepo.prototype.waitFetching = function(tick, timeout, finish) {
    var repo = this;
    var timer = function() {
        if (--tick > 0 && !repo.full()) setTimeout(timer, timeout);
        else                            finish();
    };
    setTimeout(timer, 10);
};



function GetCoverFromCache(req,res) {
  var ids = req.query.id;
  if (ids === undefined || ids.length < 8) {
    res.send("id parameter is missing");
    return;
  }
  ids = ids.split(',');
  var providers = req.query.provider;
  providers = providers == undefined ? config.providers : providers.split(',');

  var repo = new UrlRepo(ids, providers);
  repo.fetch();
  console.log("fin boucle => count: " + repo.count);
  
  repo.waitFetching(5, 1000, function() {
    console.log( repo.full() ? 'On a tout' : 'Pas tout' );
    // URL are picked up by provider priority order (request provider parameter)
    var ret = {};
    for (var id in repo.url) {
      for (var j=0, provider; provider = providers[j]; j++) {
        var url = repo.url[id][provider];
        if (url !== undefined) { ret[id] = url; break; }
      }
    }
    var callback = req.query.callback;
    res.send(callback == undefined
             ? ret
             : callback + '(' + JSON.stringify(ret) + ')' );
  });
}

app.listen(config.port);

app.get('/', function(req, res) {
  res.send('Welcome to coce');
});

app.get('/cover', GetCoverFromCache);



