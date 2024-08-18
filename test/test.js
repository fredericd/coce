const coce = require('../coce');
const fetcher = new coce.CoceFetcher(2000);

const ids = '275403143X,9780415480635,9780821417492,2847342257,9780563533191'.split(',');
//const ids = '275403143X,9782212124460'.split(',');
//const ids = '275403143X'.split(',');
const providers = 'aws,gb,ol'.split(',');
fetcher.fetch(ids, providers, function (url) {
    console.log(url);
    process.exit(0);
});
