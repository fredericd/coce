var coce = require('./coce');
var fetcher = new coce.CoceFetcher();

var ids = '9780415480635,9780821417492,2847342257,9780563533191'.split(',');
var providers = 'aws'.split(',');
fetcher.fetch(ids, providers, 2000, function(url) {
    console.log(url);
    process.exit(0);
});
