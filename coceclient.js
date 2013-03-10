/**

Usage:

var cc = new CoceClient('http://coceserver.com:8080', 'ol,gb,aws');
cc.fetch(['isbn1','isbn2'], function(isbn, url) {
  $('#isbn_'+isbn).html('<img src="'+url+'">');
});

**/

function CoceClient(url, provider) {

    var founds = {};    // Private cache for already found ISBN
    var notfounds = {}; // ISBN not found in Coce

    this.url = url;
    this.provider = provider;

    this.fetch = function(isbns, cbUpdateUI) {
        // First, find ISBNs in client-side cache
        var isbntosearch = [];
        $.each(isbns, function(i, isbn){
            var url = founds[isbn];
            if (url) {
                cbUpdateUI(isbn, url);
            } else if (notfounds[isbn] == undefined) {
                notfounds[isbn] = 1;
                isbntosearch.push(isbn);
            }
        });

        if (isbntosearch.length == 0) return;

        var url = this.url,
            provider = this.provider;
        $.ajax({
            url: url + '/cover?id=' + isbntosearch.join(',') + '&provider=' + provider,
            dataType: 'jsonp',
            success: function(urlPerISBN) {
                $.each(urlPerISBN, function(isbn, url) {
                    delete notfounds[isbn];
                    founds[isbn] = url;
                    cbUpdateUI(isbn, url);
                });
            }   
        });
    };

    this.reset = function() {
        found = {};
        notfounds = {};
    };
};

