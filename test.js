var coce = require('./coce');
var fetcher = new coce.CoceFetcher(2000);

var ids = '9780415480635,9780821417492,2847342257,9780563533191'.split(',');
var providers = 'aws'.split(',');
fetcher.fetch(ids, providers, function(url) {
    console.log(url);
    process.exit(0);
});
