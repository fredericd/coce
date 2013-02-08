# Coce

A cover image cache exposing its content as a REST web service.

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

* Install and start a Redis server

* Edit `config.json` file

* Install node.js libraries:
 
        npm install express redis aws-lib util

## Start

```bash
    cd _Coce HOME_
    node webservice.js
``̀`

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

`̀``json
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
