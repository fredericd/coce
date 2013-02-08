var fs = require('fs');
var redis = require('redis').createClient();
var aws = require('aws-lib');
var http = require('http');
var util = require('util');



var config = eval('('+fs.readFileSync('config.json','utf8')+')');
exports.config = config;

var awsProdAdv = aws.createProdAdvClient(config.aws.accessKeyId,
      config.aws.secretAccessKey, config.aws.associateTag);



/**
 * UrlRepo class
 *
 * @class UrlRepo
 * @module coce
 * @constructor
 * @param {Array} ids Array of images ID
 * @param {Array} providers Array of images providers (gb or aws)
 */
var UrlRepo = function(ids, providers) {
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
};
exports.UrlRepo = UrlRepo;


UrlRepo.RegGb = new RegExp("(zoom=5)", "g");

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
                url = url.replace(UrlRepo.RegGb, 'zoom=1');
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
 * Retrieve an ID from Open Library
 * @method ol
 * @param {String} id The resource ID to request to Open Library
 */
UrlRepo.prototype.ol = function(id) {
    var repo = this;
    var key = 'ol.' + id;
    var opts = {
        host: 'openlibrary.org',
        port: 80,
        path: "/api/books?bibkeys=" + id + "&jscmd=data",
    };
    var req = http.get(opts, function(res) {
        res.setEncoding('utf8');
        var store = '';
        res.on('data', function(data) { store += data });
        res.on('end', function() {
            eval(store);
            //console.log(util.inspect(_OLBookInfo, false, null));
            for (var id in _OLBookInfo) {
                var url = _OLBookInfo[id].cover;
                if ( url === undefined ) { continue; }
                url = url[config.ol.imageSize];
                redis.setex(key, config.timeout, url);
                if (repo.url[id] === undefined) repo.url[id] = {};
                repo.url[id]['ol'] = url;
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
 * @param {String} provider (aws|gb|ol) to search for
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
            if ( provider == 'gb' || provider == 'aws' || provider == 'ol' )
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


