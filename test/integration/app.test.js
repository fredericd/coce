const request = require('supertest');
const nock = require('nock');
const redis = require('redis-mock');
const responses = require('../fixtures/responses');

// Mock Redis before requiring the app
const originalCreateClient = require('redis').createClient;
require('redis').createClient = redis.createClient;

const app = require('../../app');

describe('Coce Express App', function() {
  beforeEach(function() {
    nock.cleanAll();
  });

  afterEach(function() {
    nock.cleanAll();
  });

  describe('GET /', function() {
    it('should return welcome message', function(done) {
      request(app)
        .get('/')
        .expect(200)
        .expect('Welcome to coce')
        .end(done);
    });
  });

  describe('GET /cover', function() {
    describe('Input validation', function() {
      it('should return 400 for missing id parameter', function(done) {
        request(app)
          .get('/cover')
          .expect(400)
          .expect((res) => {
            expect(res.body.error).to.include('ID parameter is required');
          })
          .end(done);
      });

      it('should return 400 for short id parameter', function(done) {
        request(app)
          .get('/cover?id=123')
          .expect(400)
          .expect((res) => {
            expect(res.body.error).to.include('ID parameter must be at least 8 characters');
          })
          .end(done);
      });

      it('should return 400 for empty id list', function(done) {
        request(app)
          .get('/cover?id=,,,')
          .expect(400)
          .expect((res) => {
            expect(res.body.error).to.include('At least one valid ID is required');
          })
          .end(done);
      });

      it('should accept valid ISBN', function(done) {
        const isbn = '9780415480635';
        
        // Mock Google Books response (default provider)
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}`)
          .expect(200)
          .end(done);
      });

      it('should accept X-ended ISBN-10', function(done) {
        const isbn = '275403143X';
        
        // Mock Google Books response
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .end(done);
      });
    });

    describe('Provider handling', function() {
      it('should use default providers when none specified', function(done) {
        const isbn = '9780415480635';
        
        // Mock all default providers
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);
          
        nock('https://images-na.ssl-images-amazon.com')
          .head(/.*/)
          .reply(200);
          
        nock('http://openlibrary.org')
          .get('/api/books')
          .query(true)
          .reply(200, responses.openLibrary.empty);

        request(app)
          .get(`/cover?id=${isbn}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(done);
      });

      it('should use specified providers', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .expect((res) => {
            expect(res.body[isbn]).to.exist;
          })
          .end(done);
      });

      it('should handle multiple providers', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);
          
        nock('https://images-na.ssl-images-amazon.com')
          .head(/.*/)
          .reply(200);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb,aws&all`)
          .expect(200)
          .expect((res) => {
            expect(res.body[isbn]).to.exist;
            expect(res.body[isbn]).to.be.an('object');
          })
          .end(done);
      });
    });

    describe('Response formats', function() {
      it('should return JSON by default', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .expect('Content-Type', /json/)
          .expect((res) => {
            expect(res.body).to.be.an('object');
          })
          .end(done);
      });

      it('should return JSONP when callback specified', function(done) {
        const isbn = '9780415480635';
        const callback = 'myCallback';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb&callback=${callback}`)
          .expect(200)
          .expect('Content-Type', /javascript/)
          .expect((res) => {
            expect(res.text).to.include(`${callback}(`);
            expect(res.text).to.include(')');
          })
          .end(done);
      });

      it('should return first available URL without &all parameter', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);
          
        nock('https://images-na.ssl-images-amazon.com')
          .head(/.*/)
          .reply(200);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb,aws`)
          .expect(200)
          .expect((res) => {
            expect(res.body[isbn]).to.be.a('string');
          })
          .end(done);
      });

      it('should return all URLs with &all parameter', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);
          
        nock('https://images-na.ssl-images-amazon.com')
          .head(/.*/)
          .reply(200);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb,aws&all`)
          .expect(200)
          .expect((res) => {
            expect(res.body[isbn]).to.be.an('object');
            expect(Object.keys(res.body[isbn]).length).to.be.greaterThan(0);
          })
          .end(done);
      });
    });

    describe('Multiple ISBNs', function() {
      it('should handle multiple ISBNs', function(done) {
        const isbns = '9780415480635,9780821417492';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbns}&provider=gb`)
          .expect(200)
          .expect((res) => {
            expect(Object.keys(res.body).length).to.be.greaterThan(1);
          })
          .end(done);
      });

      it('should handle mixed results (some found, some not)', function(done) {
        const isbns = '9780415480635,nonexistent';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbns}&provider=gb`)
          .expect(200)
          .expect((res) => {
            expect(res.body['9780415480635']).to.exist;
            expect(res.body['nonexistent']).to.not.exist;
          })
          .end(done);
      });
    });

    describe('Error handling', function() {
      it('should handle provider errors gracefully', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .replyWithError('Network error');

        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .expect((res) => {
            // Should return empty result, not error
            expect(res.body).to.be.an('object');
          })
          .end(done);
      });

      it('should handle timeout gracefully', function(done) {
        const isbn = '9780415480635';
        
        nock('https://books.google.com')
          .get('/books')
          .query(true)
          .delay(10000) // Longer than default timeout
          .reply(200, responses.googleBooks.valid);

        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .end(done);
      });

      it('should return 400 for invalid provider', function(done) {
        const isbn = '9780415480635';
        
        request(app)
          .get(`/cover?id=${isbn}&provider=invalid`)
          .expect(400)
          .expect((res) => {
            expect(res.body.error).to.include('Invalid providers');
          })
          .end(done);
      });
    });
  });

  describe('GET /set', function() {
    it('should set URL manually', function(done) {
      const provider = 'aws';
      const id = '9780415480635';
      const url = 'http://example.com/cover.jpg';

      request(app)
        .get(`/set?provider=${provider}&id=${id}&url=${encodeURIComponent(url)}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).to.be.true;
        })
        .end(done);
    });

    it('should require all parameters', function(done) {
      request(app)
        .get('/set?provider=aws&id=123')
        .expect(400)
        .end(done);
    });
  });

  describe('Error scenarios', function() {
    it('should handle malformed responses', function(done) {
      const isbn = '9780415480635';
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.malformed);

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.be.an('object');
        })
        .end(done);
    });

    it('should handle HTTP errors from providers', function(done) {
      const isbn = '9780415480635';
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(500, 'Internal Server Error');

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .end(done);
    });

    it('should handle network connectivity issues', function(done) {
      const isbn = '9780415480635';
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .replyWithError({
          code: 'ECONNREFUSED',
          message: 'Connection refused'
        });

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .end(done);
    });
  });
});

// Restore original Redis after tests
after(function() {
  require('redis').createClient = originalCreateClient;
});
