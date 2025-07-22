const redis = require('redis-mock');
const nock = require('nock');
const responses = require('../fixtures/responses');

// Mock Redis before requiring coce
const originalCreateClient = require('redis').createClient;
require('redis').createClient = redis.createClient;

const coce = require('../../coce');

describe('Redis Integration', function() {
  let fetcher;
  let redisClient;
  
  beforeEach(function() {
    fetcher = new coce.CoceFetcher(5000);
    redisClient = redis.createClient();
    nock.cleanAll();
  });

  afterEach(function() {
    nock.cleanAll();
    if (redisClient) {
      redisClient.flushall();
    }
  });

  describe('Cache behavior', function() {
    it('should cache URLs in Redis', function(done) {
      const provider = 'gb';
      const id = '9780415480635';
      const url = 'http://example.com/cover.jpg';
      
      fetcher.addurl(provider, id, url);
      
      // Check if URL was cached
      setTimeout(() => {
        redisClient.get(`${provider}.${id}`, (err, reply) => {
          expect(err).to.be.null;
          expect(reply).to.equal(url);
          done();
        });
      }, 50);
    });

    it('should retrieve URLs from cache', function(done) {
      const provider = 'gb';
      const id = '9780415480635';
      const url = 'http://example.com/cover.jpg';
      const ids = [id];
      
      // Pre-populate cache
      redisClient.setex(`${provider}.${id}`, 3600, url, () => {
        fetcher.add(ids, provider);
        
        setTimeout(() => {
          expect(fetcher.url[id]).to.exist;
          expect(fetcher.url[id][provider]).to.equal(url);
          done();
        }, 100);
      });
    });

    it('should handle cache misses', function(done) {
      const provider = 'gb';
      const id = '9780415480635';
      const ids = [id];
      
      // Mock the external API call
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);
      
      fetcher.add(ids, provider);
      
      setTimeout(() => {
        // Should have made external call and cached result
        expect(fetcher.url[id]).to.exist;
        expect(fetcher.url[id][provider]).to.exist;
        done();
      }, 200);
    });

    it('should handle empty cache entries', function(done) {
      const provider = 'gb';
      const id = 'nonexistent';
      const ids = [id];
      
      // Pre-populate cache with empty value (indicating no URL available)
      redisClient.setex(`${provider}.${id}`, 3600, '', () => {
        fetcher.add(ids, provider);
        
        setTimeout(() => {
          // Should not have URL for this ID
          expect(fetcher.url[id]).to.not.exist;
          done();
        }, 100);
      });
    });
  });

  describe('Cache expiration', function() {
    it('should respect cache timeout settings', function(done) {
      const provider = 'gb';
      const id = '9780415480635';
      const url = 'http://example.com/cover.jpg';
      
      // Set with very short timeout
      redisClient.setex(`${provider}.${id}`, 1, url, () => {
        // Wait for expiration
        setTimeout(() => {
          redisClient.get(`${provider}.${id}`, (err, reply) => {
            expect(reply).to.be.null; // Should be expired
            done();
          });
        }, 1100);
      });
    });
  });

  describe('Multiple providers caching', function() {
    it('should cache URLs from different providers separately', function(done) {
      const id = '9780415480635';
      const gbUrl = 'http://gb.example.com/cover.jpg';
      const awsUrl = 'http://aws.example.com/cover.jpg';
      
      fetcher.addurl('gb', id, gbUrl);
      fetcher.addurl('aws', id, awsUrl);
      
      setTimeout(() => {
        redisClient.get(`gb.${id}`, (err, gbReply) => {
          expect(gbReply).to.equal(gbUrl);
          
          redisClient.get(`aws.${id}`, (err, awsReply) => {
            expect(awsReply).to.equal(awsUrl);
            done();
          });
        });
      }, 50);
    });
  });

  describe('Error handling', function() {
    it('should handle Redis connection errors gracefully', function(done) {
      // This test would be more meaningful with a real Redis connection
      // For now, we test that the mock doesn't break the flow
      const provider = 'gb';
      const id = '9780415480635';
      const ids = [id];
      
      nock('https://books.google.com')
        .get('/books')
        .query(true)
        .reply(200, responses.googleBooks.valid);
      
      fetcher.add(ids, provider);
      
      setTimeout(() => {
        // Should still work even if Redis has issues
        expect(fetcher.url[id]).to.exist;
        done();
      }, 200);
    });
  });

  describe('Manual URL setting', function() {
    it('should allow manual URL setting via coce.set', function(done) {
      const provider = 'aws';
      const id = '9780415480635';
      const url = 'http://manual.example.com/cover.jpg';
      
      coce.set(provider, id, url);
      
      setTimeout(() => {
        redisClient.get(`${provider}.${id}`, (err, reply) => {
          expect(reply).to.equal(url);
          done();
        });
      }, 50);
    });
  });
});

// Restore original Redis after tests
after(function() {
  require('redis').createClient = originalCreateClient;
});
