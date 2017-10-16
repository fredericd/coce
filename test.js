var coce = require('./coce');
var fetcher = new coce.CoceFetcher(2000);

var ids = '275403143X,9780415480635,9780821417492,2847342257,9780563533191'.split(',');
//var ids = '275403143X,9782212124460'.split(',');
//var ids = '275403143X'.split(',');
var providers = 'amazon'.split(',');
fetcher.fetch(ids, providers, function(url) {
    console.log(url);
    process.exit(0);
});
