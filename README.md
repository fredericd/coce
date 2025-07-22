# Coce

A cover image URLs cache exposing its content as a REST web service.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

In various softwares (ILS for example), Book (or other kind of resources)
cover image is displayed in front of the resource. Those images are fetched
automatically from providers, such as Google or Amazon. Providers propose web
services to retrieve information on Books from an ID (ISBN for example).

* [Google API](https://developers.google.com/books/docs/dynamic-links)
* [Amazon Product Advertising
  API](https://affiliate-program.amazon.com/gp/advertising/api/detail/main.html)
* [Open Library Read API](http://openlibrary.org/dev/docs/api/read)
* [ORB](https://www.base-orb.fr)

With Coce, the cover images URL from various providers are cached in a Redis
server. Client send REST request to Coce which reply with cached URL, or if not
available in its cache retrieving them from providers. In its request, the
client specify a providers order (for example `aws,gb,ol` for AWS, Google, and
then Open Library): Coce send the first available URL. It's also possible to not
only cache images URL but images themselves.


## Installation

* Install and start a __Redis server__

* Install [node.js](http://nodejs.org/)

* Install __node.js libraries__. In Coce home directory, enter:
 
        npm install

* __Configure__ Coce operation by editing
  [config.json](https://github.com/fredericd/coce/blob/master/config.json.sample).
  Start with provided `config.json.sample` file.
  * `port` - port on which the server respond
  * `providers` - array of available providers: gb,aws,ol
  * `timeout` - timeout in miliseconds for the service. Above this value, Coce
    stops waiting response from providers
  * `redis` - Redis server parameters:
     * `host`
     * `port`
     * `timeout`
  * `cache` - Local cache for images
    * `path` - path to the directory where images are cached locally
    * `url` - base url to the `path` directory
  * `gb` - Google Books parameters:
     * `timeout` - timeout of the cached URL from Google Books
  * `ol` - Open Library parameters:
     * `timeout` - timeout of the cached URL from Open Library. After this
       delay, an URL is automatically removed from the cache, and so has to be
       re-fetched again if requested
     * `imageSize` - size of images: small, medium, large
  * `aws` - Amazon
     * `imageSize` - size of images: SmallImage, MediumImage, LargeImage
     * `timeout` - timeout when probing images url via direct http requests
  * `orb` - ORB
     * `user` - user to access ORB API
     * `key` - API key
     * `cache` - true/false, are images locally cached (and served)
     * `timeout` - timeout when probing images url via direct http requests

## Start

```bash
cd _Coce HOME_
node app.js
```

## Testing

Coce includes a comprehensive test suite to ensure reliability and catch regressions during development.

### Prerequisites

The test suite uses mocked external dependencies, so no external services (Redis, internet connection) are required for testing.

### Running Tests

```bash
# Install dependencies (including test dependencies)
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only

# Run tests with verbose output
VERBOSE_TESTS=1 npm test
```

### Test Runner Script

For convenience, use the test runner script:

```bash
# Run all tests
./run-tests.sh

# Run specific test types
./run-tests.sh unit         # Unit tests
./run-tests.sh integration  # Integration tests
./run-tests.sh config       # Configuration tests
./run-tests.sh performance  # Performance tests

# Run with linting
./run-tests.sh ci          # Full CI suite (lint + all tests)
```

### Test Structure

- **Unit Tests**: Core functionality, configuration validation, individual provider logic
- **Integration Tests**: API endpoints, Redis caching, error scenarios
- **Performance Tests**: Large datasets, concurrent requests, timeout handling
- **Mocked Dependencies**: All external services (HTTP requests, Redis) are mocked for reliable testing

### Continuous Integration

Tests run automatically on:
- Every push to main branches
- Pull requests
- Multiple Node.js versions (16.x, 18.x, 20.x)
- Both with and without Redis service

See `test/README.md` for detailed testing documentation.

## Deployment on a production server

By default, running Coce directly, there isn't any supervision mechanism, and
Coce run as a multi-threaded single process (as any Node.js application). In
production, it is necessary to transform Coce into a Linux service, with
automatic start/stop, and supervision. Traditional Unix process supervision
architecture could be used: [Unix System V
Init](http://en.wikipedia.org/wiki/Init), [runit](http://smarden.org/runit/), or
[daemon](http://man7.org/linux/man- pages/man3/daemon.3.html).

A more **Node.js** approach is to utilise [pm2](https://pm2.keymetrics.io/)
daemon process manager.

pm2 global installation (Debian/Ubuntu): `sudo npm i -g pm2`

You ask pm2 to use all available core for coce: `pm2 start app.js --name coce -i max`.

Monitoring of you daemons: `pm2 monit`

Program auto-startup:

```bash
cd _COCE_HOME_
pm2 start app.js --name coce -i max
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u your_user_name --hp _HOME_
```

## Redis persistence

Coce book cover images are stored in Redis. By default, there is no [data
persistence](https://redis.io/topics/persistence). It means that if you restart
your server, all the urls patienly collected will be lost.

By default, on a Debian/Ubuntu box, Redis saves its state in a file:
`/var/lib/redis/dump.rdb`. You can backup this file, automatically with a cron
job. To restore a backup, you just have to stop the Redis server, copy the file,
and restart Redis. Something like that:

```bash
systemctl stop redis-server
cp path_name_to_backup/dump.rdb /var/lib/redis
systemctl start redis-server
```

## Service usage

To get all cover images from Open Library (ol), Google Books (gb), and Amazon
(aws) for several ISBN:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws&all

This request returns:

```json
{
  "2847342257": {
    "aws": "https://images-na.ssl-images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg"
  },
  "9780563533191": {
    "ol": "https://covers.openlibrary.org/b/id/2520432-M.jpg",
    "gb": "https://books.google.com/books/content?id=OphMAAAACAAJ&printsec=frontcover&img=1&zoom=1",
    "aws": "https://images-na.ssl-images-amazon.com/images/I/412CFNG0QEL._SL160_.jpg"
  },
  "9780415480635": {
    "gb": "https://books.google.com/books/content?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1",
    "aws": "https://images-na.ssl-images-amazon.com/images/I/41HOtyaxTlL._SL160_.jpg"
  },
  "9780821417492": {
    "gb": "https://books.google.com/books/content?id=D5yimAEACAAJ&printsec=frontcover&img=1&zoom=1",
    "aws": "https://images-na.ssl-images-amazon.com/images/I/417jg7TjvYL._SL160_.jpg"
  }
}
```

Without the `&all` parameter, the same request returns first URL per ISBN, by
provider order:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws

returns:

```json
{
  "2847342257": "https://images-na.ssl-images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg",
  "9780563533191": "https://covers.openlibrary.org/b/id/2520432-M.jpg",
  "9780415480635": "https://books.google.com/books/content?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1",
  "9780821417492": "https://books.google.com/books/content?id=D5yimAEACAAJ&printsec=frontcover&img=1&zoom=1"
}
```

By adding a callback JavaScript function to the request, Coce returns its result
as JSONP:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws&callback=populateImg

return:

```jsonp
populateImg({"2847342257":"https://images-na.ssl-images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg","9780563533191":"https://covers.openlibrary.org/b/id/2520432-M.jpg","9780415480635":"https://books.google.com/books/content?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1","9780821417492":"https://books.google.com/books/content?id=D5yimAEACAAJ&printsec=frontcover&img=1&zoom=1"})
```

## Client-side usage

See `sample-client.html` for a Coce sample usage from JavaScript. It uses
`coceclient.js` module, which is use like this:

```javascript
// isbns is an array of ISBNs
var coceClient = new CoceClient('http://coceserver.com:8080', 'ol,aws,gb');
coceClient.fetch(isbns, function(isbn, url) {
  $('#isbn_'+isbn).html('<img src="+url)+'"");
});
```

## Performance

__coce__ is highly scalable. With all requested URLs in cache, ``ab`` test,
10000 requests, with 50 concurrent requests:

    ab -n 10000 -c 50 http://localhost:8080/cover?id=9780415480635,97808?1417492,2847342257,9780563533191&provider=gb,aws

gives this result:

```
Document Path:          /cover?id=9780415480635,97808?1417492,2847342257,9780563533191
Document Length:        431 bytes

Concurrency Level:      50
Time taken for tests:   5.333 seconds
Complete requests:      10000
Failed requests:        0
Total transferred:      6350000 bytes
HTML transferred:       4310000 bytes
Requests per second:    1874.97 [#/sec] (mean)
Time per request:       26.667 [ms] (mean)
Time per request:       0.533 [ms] (mean, across all concurrent requests)
Transfer rate:          1162.70 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.5      0      10
Processing:     6   25   5.8     24     348
Waiting:        5   24   5.6     23     338
Total:          6   25   5.8     24     348

Percentage of the requests served within a certain time (ms)
  50%     24
  66%     25
  75%     27
  80%     28
  90%     31
  95%     34
  98%     37
  99%     40
 100%    348 (longest request)
```
