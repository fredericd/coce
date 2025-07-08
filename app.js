const express = require('express');
const coce = require('./coce');

const app = express();

app.listen(coce.config.port);

app.get('/', (req, res) => {
  res.send('Welcome to coce');
});

app.get('/cover', (req, res) => {
  let ids = req.query.id;
  if (ids === undefined || ids.length < 8) {
    res.status(400).send({ error: 'ID parameter is missing' });
    return;
  }
  ids = ids.split(',');
  if (ids.length === 0) {
    res.status(400).send({ error: 'Bad id parameter' });
    return;
  }
  let providers = req.query.provider;
  providers = providers === undefined ? coce.config.providers : providers.split(',');
  const { callback } = req.query;

  const fetcher = new coce.CoceFetcher();
  fetcher.fetch(ids, providers, (url) => {
    if (url.error !== undefined) {
      res.status(400).send(url);
      return;
    }
    let ret = url;
    if (req.query.all === undefined) {
      // No &all param: URL are picked up by provider priority order
      // Just the first available url
      ret = {};
      Object.keys(url).forEach((id) => {
        const urlPerProvider = url[id];
        const firstProvider = providers.find((provider) => urlPerProvider[provider] !== undefined);
        if (firstProvider !== undefined) ret[id] = urlPerProvider[firstProvider];
      });
    }
    if (callback) {
      res.contentType('application/javascript');
      ret = `${callback}(${JSON.stringify(ret)})`;
    } else {
      res.contentType('application/json');
    }
    res.send(ret);
  });
});

app.get('/set', (req, res) => {
  const { provider, id, url } = req.query;
  coce.set(provider, id, url);
  res.send({ success: true });
});

// Export app for testing
module.exports = app;
