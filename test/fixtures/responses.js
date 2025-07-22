// Mock responses from external providers

const googleBooksResponse = `_GBSBookInfo = {
  "9780415480635": {
    "bib_key": "9780415480635",
    "info_url": "https://books.google.com/books?id=Yc30cofv4_MC",
    "preview_url": "https://books.google.com/books?id=Yc30cofv4_MC",
    "thumbnail_url": "https://books.google.com/books/content?id=Yc30cofv4_MC&printsec=frontcover&img=1&zoom=5&source=gbs_api"
  },
  "9780821417492": {
    "bib_key": "9780821417492",
    "info_url": "https://books.google.com/books?id=D5yimAEACAAJ",
    "preview_url": "https://books.google.com/books?id=D5yimAEACAAJ",
    "thumbnail_url": "https://books.google.com/books/content?id=D5yimAEACAAJ&printsec=frontcover&img=1&zoom=5&source=gbs_api"
  }
};`;

const openLibraryResponse = `_OLBookInfo = {
  "9780563533191": {
    "cover": {
      "small": "https://covers.openlibrary.org/b/id/2520432-S.jpg",
      "medium": "https://covers.openlibrary.org/b/id/2520432-M.jpg",
      "large": "https://covers.openlibrary.org/b/id/2520432-L.jpg"
    }
  }
};`;

const orbResponse = {
  "data": [
    {
      "ean13": "9780415480635",
      "images": {
        "front": {
          "thumbnail": {
            "src": "https://api.base-orb.fr/images/thumb/9780415480635.jpg"
          }
        }
      }
    }
  ]
};

const emptyGoogleBooksResponse = '_GBSBookInfo = {};';
const emptyOpenLibraryResponse = '_OLBookInfo = {};';
const emptyOrbResponse = { "data": [] };

const malformedGoogleBooksResponse = 'invalid javascript code {';
const malformedOrbResponse = '{"invalid": json}';

module.exports = {
  googleBooks: {
    valid: googleBooksResponse,
    empty: emptyGoogleBooksResponse,
    malformed: malformedGoogleBooksResponse
  },
  openLibrary: {
    valid: openLibraryResponse,
    empty: emptyOpenLibraryResponse
  },
  orb: {
    valid: orbResponse,
    empty: emptyOrbResponse,
    malformed: malformedOrbResponse
  }
};
