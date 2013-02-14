var fs = require('fs');
var aws = require('aws-lib');
var http = require('http');
var util = require('util');


var config = eval('('+fs.readFileSync('config.json','utf8')+')');
exports.config = config;

var redis = require('redis').createClient(config.redis.port, config.redis.host);

var awsProdAdv = aws.createProdAdvClient(config.aws.accessKeyId,
      config.aws.secretAccessKey, config.aws.associateTag);



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

    /**
     * URLs found in the cache (or from providers)
     * @property url
     * @type Object
     */
    this.url = {};
};
exports.CoceFetcher = CoceFetcher;


CoceFetcher.RegGb = new RegExp("(zoom=5)", "g");


/**
 * Retrieve an ID from Google Books 
 * @method gb
 * @param {Array} ids The resource IDs to request to Google Books
 */
CoceFetcher.prototype.gb = function(ids) {
    var repo = this;
    var opts = {
        host: 'books.google.com',
        port: 80,
        path: "/books?bibkeys=" + ids.join(',') + "&jscmd=viewapi",
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
                url = url.replace(CoceFetcher.RegGb, 'zoom=1');
                redis.setex('gb.'+id, config.gb.timeout, url);
                if (repo.url[id] === undefined) repo.url[id] = {};
                repo.url[id]['gb'] = url;
                //console.log('gb.'+id +': ' + url);
                //console.log(util.inspect(repo, false, null));
            }
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
    var repo = this;
    var opts = {
        host: 'openlibrary.org',
        port: 80,
        path: "/api/books?bibkeys=" + ids.join(',') + "&jscmd=data",
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
                if (url === undefined) continue;
                url = url[config.ol.imageSize];
                redis.setex('ol.'+id, config.ol.timeout, url);
                if (repo.url[id] === undefined) repo.url[id] = {};
                repo.url[id]['ol'] = url;
            }
            repo.increment(ids.length);
        });
    });
};


/**
 * Retrieve a IDs from Amazon Product Advertising API
 * @method aws
 * @param {Array} ids The resource IDs to request to Amazon
 */
CoceFetcher.prototype.aws = function(ids) {
    var repo = this;
    var options = { 
        host: config.aws.host,
        region: config.aws.region,
        SearchIndex: 'All',
        IdType: 'EAN',
        ResponseGroup: 'Images'
    };
    // FIXME: A request per ID is sent to AWS. A better solution should send
    // grouped queries. But difficult to achieve with AWS API.
    for (var i=0; i < ids.length; i++) {
        (function(){
            var id = ids[i];
            options.ItemId = id;
            awsProdAdv.call('ItemLookup', options, function(err, result) {
                console.log(util.inspect(result, false, null));
                var items = result.Items;
                if (items.Request.Errors ) {
                    console.log('------- AWS Error --------');
                    console.log(items.Request.Errors);
                } else {
                    var item = items.Item;
                    if (item instanceof Array) { item = item[0]; }
                    console.log(util.inspect(item, false, null));
                    var url = item[config.aws.imageSize];
                    if (url !== undefined) { // Amazon has a cover image
                        var url = url.URL;
                        redis.setex('aws.'+id, config.aws.timeout, url);
                        if (repo.url[id] === undefined) repo.url[id] = {};
                        repo.url[id]['aws'] = url;
                        //console.log('AWS added: ' + key + '=' + url);
                        //console.log(util.inspect(repo, false, null));
                    }
                }
                repo.increment();
            });
        }());
    }
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
        this.finish(this.url);
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
            //console.log('Redis GET ' + key);
            redis.get(key, function(err, reply) {
                //console.log('Redis GET result: ' + key);
                count--;
                //console.log('count=' + count);
                if ( reply === null ) {
                    // Not in the cache
                    notcached.push(id);
                    redis.setex(provider+'.'+id, config[provider].timeout, '');
                } else if ( reply === '' ) {
                    // In the cache, but no url via provider
                    //console.log('    NO URL in Redis');
                    repo.increment();
                } else {
                    //console.log('    ' + reply);
                    //console.log( repo.url);
                    if (repo.url[id] === undefined) repo.url[id] = {};
                    repo.url[id][provider] = reply;
                    repo.increment();
                } 
                if (count == 0 && timeoutId !== undefined) {
                    // We get all responses from Redis
                    clearTimeout(timeoutId);
                    //console.log("Redis: all responses received. notcached="+notcached.length);
                    if (notcached.length > 0) repo[provider](notcached);
                }
            });
        }());
     }
     // Wait all Redis responses
     //console.log("Fin Redis queries. count=" + count + " - Attente des réponses");
     timeoutId = setTimeout(function(){
         //console.log(notcached);
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
    this.url = {};

    // Validate providers
    for (var i=0; provider = providers[i]; i++)
        if (config.providers.indexOf(provider) == -1)
            throw new Error('Unavailable provider: ' + provider);
    
    for (var i=0; provider = providers[i]; i++)
        this.add(ids, provider);
    if (this.count !== this.countMax)
        this.timeoutId = setTimeout(finish, this.timeout);
};


