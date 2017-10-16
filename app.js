var express = require('express');
var app = express();
var coce = require('./coce');

app.listen(coce.config.port);

app.get('/', function(req, res) {
    res.send('Welcome to coce');
});

var isbnRE = /([0-9X]{10,13})/;

app.get('/cover', function(req, res) {
    var ids = req.query.id;
    if (ids === undefined || ids.length < 8) {
        var fail = {};
        fail.error = "ID parameter is missing";
        res.send(fail);
        return;
    }
    ids = ids.split(',');
    if (ids.length === 0) { 
        var fail = {};
        fail.error = "Bad id parameter";
        res.send(fail);
        return;
    }
    var providers = req.query.provider;
    providers = providers == undefined ? coce.config.providers : providers.split(',');
    var callback = req.query.callback;

    var fetcher = new coce.CoceFetcher();
    fetcher.fetch(ids, providers, function(url) {
        if ( req.query.all === undefined ) {
            // Not &all param: URL are picked up by provider priority order
            var ret = {};
            for (var id in url)
                for (var j=0, provider; provider = providers[j]; j++) {
                    var u = url[id][provider];
                    if ( u !== undefined ) { ret[id] = u; break; }
                }
            url = ret;
        }
        if (callback) {
            res.contentType("application/javascript");
            url = callback + '(' + JSON.stringify(url) + ')'
        } else {
            res.contentType("application/json");
        }
        res.send(url);
    });
});
