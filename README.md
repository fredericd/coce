# Coce

A cover image URLs cache exposing its content as a REST web service.

In various softwares (ILS for example), Book (or other kind of resources)
cover image is displayed in front of the resource. Those images are fetched
automatically from providers, such as Google or Amazon. Providers propose web
services to retrieve information on Books from an ID (ISBN for example).

* [Google API](https://developers.google.com/books/docs/dynamic-links)
* [Amazon Product Advertising
  API](https://affiliate-program.amazon.com/gp/advertising/api/detail/main.html)
* [Open Library Read API](http://openlibrary.org/dev/docs/api/read)

With Coce, the cover images URL from various providers are cached in a Redis
server. Client send REST request to Coce which reply with cached URL, or if not
available in its cache retrieving them from providers. In its request, the
client specify a providers order (for example `aws,gb,ol` for AWS, Google, and
then Open Library): Coce send the first available URL.


## Installation

* Install and start a __Redis server__

* Install [node.js](http://nodejs.org/)

* Install __node.js libraries__. In Coce home directory, enter:
 
        npm install

* __Configure__ Coce operation by editing [config.json](https://github.com/fredericd/coce/blob/master/config.json.sample). Start with provided `config.json.sample` file.
  * `port` - port on which the server respond
  * `providers` - array of available providers: gb,aws,ol
  * `timeout` - timeout in miliseconds for the service. Above this value, Coce stops waiting response from providers
  * `redis` - Redis server parameters:
     * `host`
     * `port`
     * `timeout`
  * `gb` - Google Books parameters:
     * `timeout` - timeout of the cached URL from Google Books
  * `ol` - Open Library parameters:
     * `timeout` - timeout of the cached URL from Open Library. After this delay, an URL is automatically removed from the cache, and so has to be re-fetched again if requested
     * `imageSize` - size of images: small, medium, large
  * `aws` - Amazon parameters. In order to use AWS, you need to create a [credential](http://docs.aws.amazon.com/IAM/latest/UserGuide/ManagingCredentials.html). Create a user and give him credential to [Amazon Product Advertising API](http://docs.aws.amazon.com/AWSECommerceService/latest/DG/Welcome.html):
     * `host` - The API is available for several locales. If omitted, USA by default. For France: webservices.amazon.fr. See the [List of locales](http://docs.aws.amazon.com/AWSECommerceService/latest/DG/Locales.html).
     * `accessKeyId`
     * `secretAccessKey`
     * `associateTag`
     * `imageSize` - size of images: SmallImage, MediumImage, LargeImage



## Start

```bash
cd _Coce HOME_
node app.js
```

## Deployment on a production server

By default, running Coce directly, there isn't any supervision mechanism, and
Coce run as a multi-threaded single process (as any node.js application). In
production, it is necessary to transform Coce into a Linux service, with
automatic start/stop, and supervision. Traditional Unix process supervision
architecture could be used: [Unix System V
Init](http://en.wikipedia.org/wiki/Init), [runit](http://smarden.org/runit/),
or [daemon](http://man7.org/linux/man- pages/man3/daemon.3.html).

A more sophisticated approach could be utilised by using [Phusion
Passenger](https://www.phusionpassenger.com/). This way, it's possible to make
Coce respond to requests on http (80) port, even with other webapps running on
the same server, and to run a Coce process on each core of a multi-core
server.

For example, on Debian follow this
[instructions](https://www.phusionpassenger.com/library/install/standalone/install/oss/).
And start, coce, beeing in coce directory:

```bash
passenger start --port 8080
```
Daemonize:

```bash
passenger start --port 8080 --daemonize
```

Since passenger manages the service restart automatically, the service startup can just be
put in `/etc/rc.local` on various Linux distributions.

## Service usage

To get all cover images from Open Library (ol), Google Books (gb), and Amazon
(aws) for several ISBN:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws&all

This request returns:

```json
{
  "2847342257": {
    "aws": "http://ecx.images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg"
  },
  "9780415480635": {
    "gb": "http://bks3.books.google.com/books?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1",
    "aws": "http://ecx.images-amazon.com/images/I/41G7N7fSFvL._SL160_.jpg"
  },
  "9780821417492": {
    "gb": "http://bks5.books.google.com/books?id=3vTqJ6ecRMIC&printsec=frontcover&img=1&zoom=1&edge=curl",
    "aws": "http://ecx.images-amazon.com/images/I/417jg7TjvYL._SL160_.jpg"
  },
  "9780563533191": {
    "ol": "http://covers.openlibrary.org/b/id/2520432-M.jpg",
    "gb": "http://bks0.books.google.com/books?id=OphMAAAACAAJ&printsec=frontcover&img=1&zoom=1",
    "aws": "http://ecx.images-amazon.com/images/I/412CFNG0QEL._SL160_.jpg"
  }
}
```

Without the `&all` parameter, the same request returns first URL per ISBN, by
provider order:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws

returns:

```json
{
  "2847342257": "http://ecx.images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg",
  "9780415480635": "http://bks3.books.google.com/books?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1",
  "9780821417492": "http://bks5.books.google.com/books?id=3vTqJ6ecRMIC&printsec=frontcover&img=1&zoom=1&edge=curl",
  "9780563533191": "http://covers.openlibrary.org/b/id/2520432-M.jpg"
}

```

By adding a callback JavaScript function to the request, Coce returns its result as JSONP:

    http://coce.server/cover?id=9780415480635,9780821417492,2847342257,9780563533191&provider=ol,gb,aws&callback=populateImg

return:

```jsonp
    populateImg({"2847342257":"http://ecx.images-amazon.com/images/I/51LYLJRtthL._SL160_.jpg","9780415480635":"http://bks3.books.google.com/books?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=1","9780821417492":"http://bks5.books.google.com/books?id=3vTqJ6ecRMIC&printsec=frontcover&img=1&zoom=1&edge=curl","9780563533191":"http://covers.openlibrary.org/b/id/2520432-M.jpg"})
```

## Client-side usage

See `sample-client.html` for a Coce sample usage from JavaScript. It uses `coceclient.js` module, which is use like this:

```javascript
// isbns is an array of ISBNs
var coceClient = new CoceClient('http://coceserver.com:8080', 'ol,aws,gb');
coceClient.fetch(isbns, function(isbn, url) {
  $('#isbn_'+isbn).html('<img src="+url)+'"");
});
```

## Performance

__coce__ is highly scalable. With all requested URLs in cache, ``ab`` test, 10000 requests, with 50 concurrent requests:

    ab -n 10000 -c 50 http://localhost:8080/cover?id=9780415480635,97808?1417492,2847342257,9780563533191&provider=gb,aws

gives this result:

```
Document Path:          /cover?id=9780415480635,97808?1417492,2847342257,9780563533191
Document Length:        295 bytes

Concurrency Level:      50
Time taken for tests:   7.089 seconds
Complete requests:      10000
Failed requests:        0
Write errors:           0
Total transferred:      4610000 bytes
HTML transferred:       2950000 bytes
Requests per second:    1410.70 [#/sec] (mean)
Time per request:       35.443 [ms] (mean)
Time per request:       0.709 [ms] (mean, across all concurrent requests)
Transfer rate:          635.09 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    1   0.5      1       3
Processing:     9   34  16.5     32     288
Waiting:        7   29  16.4     27     278
Total:         12   35  16.5     34     290

Percentage of the requests served within a certain time (ms)
  50%     34
  66%     34
  75%     37
  80%     39
  90%     44
  95%     50
  98%     54
  99%     58
 100%    290 (longest request)
```
