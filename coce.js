var fs = require('fs');
var _redis = require('redis');
var redis = _redis.createClient();
var aws = require('aws-lib');
var express = require('express');
var http = require('http');
var app = express();
var util = require('util');


/*
 * Coce object
 */

var Coce = {

  c: eval('('+fs.readFileSync('config.json','utf8')+')'),

  init: function() {
    var c = Coce.c.aws;
    Coce.awsProdAdv = aws.createProdAdvClient(c.accessKeyId,
      c.secretAccessKey, c.associateTag);
  },

  GetCoverFromCache: function(req,res) {
    var ids = req.query.id;
    if (ids === undefined || ids.length < 8) {
      res.send("id parameter is missing");
      return;
    }
    ids = ids.split(',');
    console.log('ids='+ids + ' - length='+ids.length);
    var providers = req.query.provider;
    providers = providers == undefined ? Coce.c.providers : providers.split(',');
    var found = {};
    var count = 0, countMax = ids.length * providers.length;
    console.log("countMax = " + countMax);
    for (var i=0, id; id = ids[i]; i++) {
      for (var j=0, provider; provider = providers[j]; j++) {
        (function() {
          var key = provider + '.' + id;
          var _id = id;
          var _provider = provider;
          console.log('GET ' + key);
          redis.get(key, function(err, reply) {
            console.log('REPLY ' + key + ' ' + reply);
            if ( reply === null ) {
              // Not in the cache => search
              redis.setex(key, Coce.c.timeout, '');
              if (_provider === 'gb') {
                console.log('On cherche chez gb');
                var opts = {
                  host: 'books.google.com',
                  port: 80,
                  path: "/books?bibkeys=" + _id + "&jscmd=viewapi",
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
                      redis.setex(key, Coce.c.timeout, url);
                      if (found[_id] === undefined) { found[_id] = {}; }
                      found[_id][_provider] = url;
                      console.log('----------------------');
                      console.log(key +': ' + url);
                    }
                    count++;
                  });
                });
              } else if (_provider === 'aws' ) {
                console.log('On cherche chez aws');
                var options = { 
                  SearchIndex: 'All',
                  Keywords: _id,
                  ResponseGroup: 'Images'
                };
                Coce.awsProdAdv.call('ItemSearch', options, function(err, result) {
                  console.log(result.Items);
                  var items = result.Items;
                  if ( items.TotalResults > 0 ) {
                    var item = items.Item;
                    if (item instanceof Array) { item = item[0]; }
                    console.log(util.inspect(item, false, null));
                    var url = item[Coce.c.aws.imageSize];
                    if (url !== undefined) { // Amazon has a cover image
                      var url = url.URL;
                      redis.setex(key, Coce.c.timeout, url);
                      console.log( "image = " + url );
                      if (found[_id] === undefined) { found[_id] = {}; }
                      found[_id][_provider] = url;
                    }
                  }
                  count++;
                });
              } else {
                count++;
              }
            } else if ( reply === '' ) {
                // In the cache, but not found via provider
                console.log('  => found in redis NO URL');
                count++;
            } else {
              console.log('  => found in redis URL');
              if (found[_id] === undefined) { found[_id] = {}; }
              found[_id][_provider] = reply;
              console.log(found);
              count++;
            } 
          });
        })();
      }
    }
    console.log("fin boucle => count: " + count);
    var tickCount = 5;
    var timer = function() {
      tickCount--;
      if ( tickCount > 0 && count !== countMax) {
        console.log("Attente 1000");
        setTimeout(timer,1000);
        return;
      }
      console.log( count !== countMax ? 'Pas tout' : 'On a tout' );
      console.log('count = ' + count);
      // On retourne les URL par ordre de priorité
      var ret = {};
      for (var id in found) {
        for (var j=0, provider; provider = providers[j]; j++) {
          var url = found[id][provider];
          if (url !== undefined) {
            ret[id] = url;
            break;
          }
        }
      }
      console.log(found);
      var callback = req.query.callback;
      res.send(callback == undefined
               ? ret
               : callback + '(' + JSON.stringify(ret) + ')' );
    };
    setTimeout(timer, 10);
  }
};

Coce.init();
console.log(Coce.c);
app.listen(Coce.c.port);

app.get('/', function(req, res) {
  res.send('Welcome to coce');
});

app.get('/cover', Coce.GetCoverFromCache);



