const express = require('express');
const app = express();
const coce = require('./coce');

app.listen(coce.config.port);

app.get('/', function(req, res) {
  res.send('Welcome to coce');
});

const isbnRE = /([0-9X]{10,13})/;

app.get('/cover', (req, res) => {
  let ids = req.query.id;
  if (ids === undefined || ids.length < 8) {
    res.send({ error: 'ID parameter is missing' });
    return;
  }
  ids = ids.split(',');
  if (ids.length === 0) { 
    res.send({ error: 'Bad id parameter' });
    return;
  }
  let providers = req.query.provider;
  providers = providers == undefined ? coce.config.providers : providers.split(',');
  const callback = req.query.callback;

  const fetcher = new coce.CoceFetcher();
  fetcher.fetch(ids, providers, function(url) {
    if ( req.query.all === undefined ) {
      // Not &all param: URL are picked up by provider priority order
      // Just the first available url
      const ret = {};
      for (let id in url)
        for (var j=0, provider; provider = providers[j]; j++) {
          const u = url[id][provider];
          if ( u !== undefined ) { ret[id] = u; break; }
        }
      url = ret;
    }
    if (callback) {
      res.contentType("application/javascript");
      url = callback + '(' + JSON.stringify(url) + ')';
    } else {
      res.contentType("application/json");
    }
    res.send(url);
  })
});

app.get('/set', (req, res) => {
  let { provider, id, url } = req.query;
  coce.set(provider, id, url);
  res.send({ success: true });
});
