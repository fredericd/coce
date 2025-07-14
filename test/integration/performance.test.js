const request = require('supertest');
const nock = require('nock');
const redis = require('redis-mock');
const responses = require('../fixtures/responses');

// Mock Redis before requiring the app
const originalCreateClient = require('redis').createClient;
require('redis').createClient = redis.createClient;

const app = require('../../app');

describe('Performance and Edge Cases', function() {
  beforeEach(function() {
    nock.cleanAll();
  });

  afterEach(function() {
    nock.cleanAll();
  });

  describe('Large requests', function() {
    it('should handle multiple ISBNs efficiently', function(done) {
      this.timeout(10000);
      
      const isbns = [
        '9780415480635',
        '9780821417492',
        '2847342257',
        '9780563533191',
        '9781234567890',
        '9789876543210',
        '9780123456789',
        '9780987654321'
      ];
      
      // Mock responses for all ISBNs
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);

      const startTime = Date.now();
      
      request(app)
        .get(`/cover?id=${isbns.join(',')}&provider=gb`)
        .expect(200)
        .expect((res) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should complete within reasonable time
          expect(duration).to.be.lessThan(5000);
          expect(res.body).to.be.an('object');
        })
        .end(done);
    });

    it('should handle concurrent requests', function(done) {
      this.timeout(15000);
      
      const isbn = '9780415480635';
      const numRequests = 10;
      let completedRequests = 0;
      
      // Mock response for all requests
      nock('https://books.google.com')
        .persist()
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);

      const startTime = Date.now();
      
      for (let i = 0; i < numRequests; i++) {
        request(app)
          .get(`/cover?id=${isbn}&provider=gb`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            
            completedRequests++;
            if (completedRequests === numRequests) {
              const endTime = Date.now();
              const duration = endTime - startTime;
              
              // All requests should complete within reasonable time
              expect(duration).to.be.lessThan(10000);
              nock.cleanAll();
              done();
            }
          });
      }
    });
  });

  describe('Edge cases', function() {
    it('should handle special characters in ISBNs', function(done) {
      const isbn = '978-0-415-48063-5'; // ISBN with hyphens
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);

      request(app)
        .get(`/cover?id=${encodeURIComponent(isbn)}&provider=gb`)
        .expect(200)
        .end(done);
    });

    it('should handle very long ISBN lists', function(done) {
      this.timeout(10000);
      
      // Create a long list of ISBNs
      const isbns = [];
      for (let i = 0; i < 50; i++) {
        isbns.push(`978${String(i).padStart(10, '0')}`);
      }
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.empty);

      request(app)
        .get(`/cover?id=${isbns.join(',')}&provider=gb`)
        .expect(200)
        .end(done);
    });

    it('should handle malformed ISBNs gracefully', function(done) {
      const malformedIsbns = [
        'invalid-isbn',
        '123',
        '',
        'abcdefghij',
        '978041548063X', // Invalid checksum
        '9780415480635extra' // Too long
      ];
      
      // No need to mock since validation will reject before reaching providers
      request(app)
        .get(`/cover?id=${malformedIsbns.join(',')}&provider=gb`)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).to.include('Invalid ID format');
        })
        .end(done);
    });

    it('should handle empty responses from all providers', function(done) {
      const isbn = '9780000000000'; // Use a non-cached ISBN
      
      // Mock all providers to return empty responses
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.empty);
        
      nock('https://images-na.ssl-images-amazon.com')
        .head(/.*/)
        .reply(404);
        
      nock('http://openlibrary.org')
        .get('/api/books')
        .query(true)
        .reply(200, responses.openLibrary.empty);

      request(app)
        .get(`/cover?id=${isbn}&provider=gb,aws,ol`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.deep.equal({});
        })
        .end(done);
    });
  });

  describe('Timeout handling', function() {
    it('should handle slow provider responses', function(done) {
      this.timeout(15000);
      
      const isbn = '9780415480635';
      
      // Mock slow response
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .delay(8000) // 8 second delay
        .reply(200, responses.googleBooks.valid);

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .end(done);
    });

    it('should handle provider timeouts gracefully', function(done) {
      this.timeout(20000);
      
      const isbn = '9780415480635';
      
      // Mock very slow response that should timeout
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .delay(15000) // 15 second delay
        .reply(200, responses.googleBooks.valid);

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .expect((res) => {
          // Should return empty result due to timeout
          expect(res.body).to.be.an('object');
        })
        .end(done);
    });
  });

  describe('Memory usage', function() {
    it('should not leak memory with large responses', function(done) {
      this.timeout(10000);
      
      const isbn = '9780415480635';
      
      // Create a very large mock response
      let largeResponse = '_GBSBookInfo = {';
      for (let i = 0; i < 1000; i++) {
        largeResponse += `"isbn${i}": {"bib_key": "isbn${i}", "thumbnail_url": "http://example.com/${i}.jpg"},`;
      }
      const finalResponse = largeResponse.slice(0, -1) + '};';
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, finalResponse);

      const initialMemory = process.memoryUsage().heapUsed;
      
      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = finalMemory - initialMemory;
          
          // Memory increase should be reasonable (less than 50MB)
          expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
          done();
        });
    });
  });

  describe('Error recovery', function() {
    it('should recover from provider failures', function(done) {
      const isbn = '9780415480635';
      
      // First request fails
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .replyWithError('Network error');

      request(app)
        .get(`/cover?id=${isbn}&provider=gb`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          
          // Second request should work
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
    });

    it('should handle partial provider failures', function(done) {
      const isbn = '9780000000001'; // Use unique ISBN to avoid cache
      
      // Google Books fails, but AWS works
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .replyWithError('Network error');
        
      nock('https://images-na.ssl-images-amazon.com')
        .head(/.*/)
        .reply(200);

      request(app)
        .get(`/cover?id=${isbn}&provider=gb,aws&all`)
        .expect(200)
        .expect((res) => {
          expect(res.body[isbn]).to.exist;
          expect(res.body[isbn].aws).to.exist;
          expect(res.body[isbn].gb).to.not.exist;
        })
        .end(done);
    });
  });
});

// Restore original Redis after tests
after(function() {
  require('redis').createClient = originalCreateClient;
});
