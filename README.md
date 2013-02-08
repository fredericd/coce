# Coce

A cover image cache exposing its content as a REST web service.

In various softwares (ILS for example), Book (or other kind of resources)
cover image is displayed in front of the resource. Those images are fetched
automatically from providers, such as Google or Amazon. The both propose web
services to retrieve information on Books from an ID (ISBN for example).

* [Google API](https://developers.google.com/books/docs/dynamic-links)
* [Amazon Product Advertising
  API](https://affiliate-program.amazon.com/gp/advertising/api/detail/main.html)
* [Open Library Read API](http://openlibrary.org/dev/docs/api/read)



## Installation

* Install and start redis

* Edit config.json file

* Install node libraries:
 
        npm install express redis aws-lib util

## Start

    cd _Coce HOME_
    node coce.js

## Service


