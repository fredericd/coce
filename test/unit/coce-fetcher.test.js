const nock = require('nock');
const redis = require('redis-mock');
const responses = require('../fixtures/responses');

// Mock Redis before requiring coce
const originalCreateClient = require('redis').createClient;
require('redis').createClient = redis.createClient;

const coce = require('../../coce');

describe('CoceFetcher', function() {
  let fetcher;
  
  beforeEach(function() {
    // Create sandbox for each test
    this.sandbox = sinon.createSandbox();
    fetcher = new coce.CoceFetcher(5000);
    // Clear all HTTP mocks
    nock.cleanAll();
  });

  afterEach(function() {
    // Restore all stubs/mocks after each test
    this.sandbox.restore();
    nock.cleanAll();
  });

  describe('Constructor', function() {
    it('should create fetcher with default timeout', function() {
      const defaultFetcher = new coce.CoceFetcher();
      expect(defaultFetcher.timeout).to.equal(coce.config.timeout);
    });

    it('should create fetcher with custom timeout', function() {
      const customFetcher = new coce.CoceFetcher(3000);
      expect(customFetcher.timeout).to.equal(3000);
    });

    it('should initialize properties correctly', function() {
      expect(fetcher.count).to.equal(0);
      expect(fetcher.finished).to.equal(false);
      expect(fetcher.url).to.deep.equal({});
    });
  });

  describe('Google Books Provider', function() {
    it('should fetch covers from Google Books successfully', function(done) {
      const ids = ['9780415480635', '9780821417492'];
      
      nock('https://books.google.com')
        .get('/books')
        .query({
          bibkeys: ids.join(','),
          jscmd: 'viewapi',
          'amp;hl': 'en'
        })
        .reply(200, responses.googleBooks.valid);

      fetcher.gb(ids);
      
      // Wait for async processing
      setTimeout(() => {
        expect(fetcher.url['9780415480635']).to.exist;
        expect(fetcher.url['9780415480635']['gb']).to.include('zoom=1');
        expect(fetcher.url['9780821417492']).to.exist;
        expect(fetcher.url['9780821417492']['gb']).to.include('zoom=1');
        done();
      }, 100);
    });

    it('should handle empty Google Books response', function(done) {
      const ids = ['nonexistent'];
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.empty);

      fetcher.gb(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });

    it('should handle malformed Google Books response', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.malformed);

      fetcher.gb(ids);
      
      setTimeout(() => {
        // Should not crash, but also shouldn't have results
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });

    it('should handle network errors for Google Books', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .replyWithError('Network error');

      fetcher.gb(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });
  });

  describe('Open Library Provider', function() {
    it('should fetch covers from Open Library successfully', function(done) {
      const ids = ['9780563533191'];
      
      nock('http://openlibrary.org')
        .get('/api/books')
        .query({
          bibkeys: ids.join(','),
          jscmd: 'data'
        })
        .reply(200, responses.openLibrary.valid);

      fetcher.ol(ids);
      
      setTimeout(() => {
        expect(fetcher.url['9780563533191']).to.exist;
        expect(fetcher.url['9780563533191']['ol']).to.include('openlibrary.org');
        done();
      }, 100);
    });

    it('should handle empty Open Library response', function(done) {
      const ids = ['nonexistent'];
      
      nock('http://openlibrary.org')
        .get('/api/books')
        .query(true)
        .reply(200, responses.openLibrary.empty);

      fetcher.ol(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });

    it('should handle network errors for Open Library', function(done) {
      const ids = ['9780563533191'];
      
      nock('http://openlibrary.org')
        .get('/api/books')
        .query(true)
        .replyWithError('Connection refused');

      fetcher.ol(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });
  });

  describe('Amazon AWS Provider', function() {
    it('should fetch covers from Amazon successfully', function(done) {
      const ids = ['9780415480635'];
      
      // Mock the HEAD request to Amazon
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .reply(200);

      fetcher.aws(ids);
      
      setTimeout(() => {
        expect(fetcher.url['9780415480635']).to.exist;
        expect(fetcher.url['9780415480635']['aws']).to.include('images-na.ssl-images-amazon.com');
        done();
      }, 200);
    });

    it('should handle ISBN13 to ISBN10 conversion', function(done) {
      const ids = ['9780415480635']; // ISBN13
      
      // Should convert to ISBN10: 041548063X
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .reply(200);

      fetcher.aws(ids);
      
      setTimeout(() => {
        expect(fetcher.url['9780415480635']).to.exist;
        done();
      }, 200);
    });

    it('should handle 403 responses from Amazon', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .reply(403);

      fetcher.aws(ids);
      
      setTimeout(() => {
        expect(fetcher.url['9780415480635']).to.exist;
        expect(fetcher.url['9780415480635']['aws']).to.include('images-na.ssl-images-amazon.com');
        done();
      }, 200);
    });

    it('should handle 404 responses from Amazon', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .reply(404);

      fetcher.aws(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 200);
    });

    it('should handle network errors for Amazon', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .replyWithError('ECONNREFUSED');

      fetcher.aws(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 200);
    });
  });

  describe('ORB Provider', function() {
    beforeEach(function() {
      // Ensure ORB config exists for tests
      if (!coce.config.orb) {
        coce.config.orb = {
          user: 'testuser',
          key: 'testkey',
          timeout: 5000
        };
      }
    });

    it('should fetch covers from ORB successfully', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://api.base-orb.fr')
        .get('/v1/products')
        .query({
          eans: ids.join(','),
          sort: 'ean_asc'
        })
        .reply(200, responses.orb.valid);

      fetcher.orb(ids);
      
      setTimeout(() => {
        expect(fetcher.url['9780415480635']).to.exist;
        expect(fetcher.url['9780415480635']['orb']).to.include('api.base-orb.fr');
        done();
      }, 100);
    });

    it('should handle empty ORB response', function(done) {
      const ids = ['nonexistent'];
      
      nock('https://api.base-orb.fr')
        .get('/v1/products')
        .query(true)
        .reply(200, responses.orb.empty);

      fetcher.orb(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });

    it('should handle malformed ORB response', function(done) {
      const ids = ['9780415480635'];
      
      nock('https://api.base-orb.fr')
        .get('/v1/products')
        .query(true)
        .reply(200, responses.orb.malformed);

      fetcher.orb(ids);
      
      setTimeout(() => {
        expect(Object.keys(fetcher.url)).to.have.length(0);
        done();
      }, 100);
    });
  });

  describe('fetch method', function() {
    it('should validate providers', function(done) {
      const ids = ['9780415480635'];
      const invalidProviders = ['invalid'];
      
      fetcher.fetch(ids, invalidProviders, (result) => {
        expect(result.error).to.exist;
        expect(result.error).to.include('Unavailable provider');
        done();
      });
    });

    it('should require at least one provider', function(done) {
      const ids = ['9780415480635'];
      
      fetcher.fetch(ids, undefined, (result) => {
        expect(result.error).to.exist;
        expect(result.error).to.include('At least, one provider is required');
        done();
      });
    });

    it('should handle timeout', function(done) {
      const shortTimeoutFetcher = new coce.CoceFetcher(100);
      const ids = ['9780415480635'];
      const providers = ['gb'];
      
      // Don't mock the request so it times out
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .delay(200)
        .reply(200, responses.googleBooks.valid);

      shortTimeoutFetcher.fetch(ids, providers, (result) => {
        // Should return partial results due to timeout
        expect(result).to.be.an('object');
        done();
      });
    });

    it('should fetch from multiple providers', function(done) {
      const ids = ['9780415480635'];
      const providers = ['gb', 'aws'];
      
      // Mock both providers
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);
        
      nock('https://images-na.ssl-images-amazon.com')
        .head('/images/P/041548063X.01.MZZZZZZZZZ.jpg')
        .reply(200);

      fetcher.fetch(ids, providers, (result) => {
        expect(result['9780415480635']).to.exist;
        expect(result['9780415480635']['gb']).to.exist;
        expect(result['9780415480635']['aws']).to.exist;
        done();
      });
    });
  });

  describe('addurl method', function() {
    it('should add URL to results', function() {
      fetcher.addurl('gb', '9780415480635', 'http://example.com/cover.jpg');
      
      expect(fetcher.url['9780415480635']).to.exist;
      expect(fetcher.url['9780415480635']['gb']).to.equal('http://example.com/cover.jpg');
    });

    it('should handle multiple providers for same ID', function() {
      fetcher.addurl('gb', '9780415480635', 'http://gb.com/cover.jpg');
      fetcher.addurl('aws', '9780415480635', 'http://aws.com/cover.jpg');
      
      expect(fetcher.url['9780415480635']['gb']).to.equal('http://gb.com/cover.jpg');
      expect(fetcher.url['9780415480635']['aws']).to.equal('http://aws.com/cover.jpg');
    });
  });

  describe('increment method', function() {
    it('should increment count', function() {
      const initialCount = fetcher.count;
      fetcher.increment();
      expect(fetcher.count).to.equal(initialCount + 1);
    });

    it('should increment by specified amount', function() {
      const initialCount = fetcher.count;
      fetcher.increment(5);
      expect(fetcher.count).to.equal(initialCount + 5);
    });

    it('should call finish when count reaches countMax', function(done) {
      fetcher.countMax = 1;
      fetcher.finish = (result) => {
        expect(result).to.deep.equal(fetcher.url);
        done();
      };
      
      fetcher.increment();
    });
  });
});

// Restore original Redis after tests
after(function() {
  require('redis').createClient = originalCreateClient;
});
