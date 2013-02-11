var coce = require('./coce');
var fetcher = new coce.CoceFetcher(2000);

var ids = '3344428017583'.split(',');
var providers = 'aws'.split(',');
fetcher.fetch(ids, providers, function(url) {
    console.log(url);
    process.exit(0);
});
