var express = require('express');
var app = express();
var coce = require('./coce');

app.listen(coce.config.port);

app.get('/', function(req, res) {
    res.send('Welcome to coce');
});

app.get('/cover', function(req, res) {
    var ids = req.query.id;
    if (ids === undefined || ids.length < 8) {
        res.send("id parameter is missing");
        return;
    }
    ids = ids.split(',');
    var providers = req.query.provider;
    providers = providers == undefined ? coce.config.providers : providers.split(',');

    var fetcher = new coce.CoceFetcher();
    fetcher.fetch(ids, providers, function(url) {
        if ( req.query.all !== undefined ) {
            // If &all param: returns all URLs
            res.send(url);
            return;
        }
        // URL are picked up by provider priority order (request provider parameter)
        var ret = {};
        for (var id in url) {
            for (var j=0, provider; provider = providers[j]; j++) {
                var u = url[id][provider];
                if (u !== undefined) { ret[id] = u; break; }
            }
        }
        var callback = req.query.callback;
        res.send(callback == undefined
                 ? ret
                 : callback + '(' + JSON.stringify(ret) + ')' );
    });
});

