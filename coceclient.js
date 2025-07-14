/* eslint-env browser */
/* global $ */
/**
 * CoceClient - Client-side library for Coce cover image service
 *
 * Usage:
 *
 * var cc = new CoceClient('http://coceserver.com:8080', 'ol,gb,aws');
 * cc.fetch(['isbn1','isbn2'], function(isbn, url) {
 *   $('#isbn_'+isbn).html('<img src="'+url+'">');
 * });
 *
 */

function CoceClient(url, provider) {
  const founds = {}; // Private cache for already found ISBN
  let notfounds = {}; // ISBN not found in Coce

  this.url = url;
  this.provider = provider;

  this.fetch = function fetchCovers(isbns, cbUpdateUI) {
    // First, find ISBNs in client-side cache
    const isbntosearch = [];
    $.each(isbns, (i, isbn) => {
      const cachedUrl = founds[isbn];
      if (cachedUrl) {
        cbUpdateUI(isbn, cachedUrl);
      } else if (notfounds[isbn] === undefined) {
        notfounds[isbn] = 1;
        isbntosearch.push(isbn);
      }
    });

    if (isbntosearch.length === 0) {
      return;
    }

    const { url: serviceUrl } = this;
    const { provider: serviceProvider } = this;
    $.ajax({
      url: `${serviceUrl}/cover?id=${isbntosearch.join(',')}&provider=${serviceProvider}`,
      dataType: 'jsonp',
      success(urlPerISBN) {
        $.each(urlPerISBN, (isbn, coverUrl) => {
          delete notfounds[isbn];
          founds[isbn] = coverUrl;
          cbUpdateUI(isbn, coverUrl);
        });
      },
    });
  };

  this.reset = function resetCache() {
    Object.keys(founds).forEach((key) => {
      delete founds[key];
    });
    notfounds = {};
  };
}

// Export for use
// eslint-disable-next-line no-unused-vars
const CoceClientConstructor = CoceClient;
