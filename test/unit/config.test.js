const fs = require('fs');
const path = require('path');

// Mock Redis before requiring coce
const redis = require('redis-mock');
const originalCreateClient = require('redis').createClient;
require('redis').createClient = redis.createClient;

describe('Configuration', function() {
  let originalConfig;
  
  before(function() {
    // Save original config
    delete require.cache[require.resolve('../../coce')];
    originalConfig = require('../../coce').config;
  });

  after(function() {
    // Restore original Redis after tests
    require('redis').createClient = originalCreateClient;
  });

  describe('Default configuration', function() {
    it('should load configuration successfully', function() {
      expect(originalConfig).to.exist;
      expect(originalConfig).to.be.an('object');
    });

    it('should have required properties', function() {
      expect(originalConfig.port).to.exist;
      expect(originalConfig.providers).to.exist;
      expect(originalConfig.timeout).to.exist;
      expect(originalConfig.redis).to.exist;
    });

    it('should have valid port number', function() {
      expect(originalConfig.port).to.be.a('number');
      expect(originalConfig.port).to.be.greaterThan(0);
      expect(originalConfig.port).to.be.lessThan(65536);
    });

    it('should have valid providers array', function() {
      expect(originalConfig.providers).to.be.an('array');
      expect(originalConfig.providers.length).to.be.greaterThan(0);
      
      const validProviders = ['gb', 'aws', 'ol', 'orb'];
      originalConfig.providers.forEach(provider => {
        expect(validProviders).to.include(provider);
      });
    });

    it('should have valid timeout', function() {
      expect(originalConfig.timeout).to.be.a('number');
      expect(originalConfig.timeout).to.be.greaterThan(0);
    });

    it('should have Redis configuration', function() {
      expect(originalConfig.redis).to.be.an('object');
      expect(originalConfig.redis.host).to.exist;
      expect(originalConfig.redis.port).to.exist;
      expect(originalConfig.redis.timeout).to.exist;
    });
  });

  describe('Provider configurations', function() {
    it('should have Google Books configuration', function() {
      if (originalConfig.providers.includes('gb')) {
        expect(originalConfig.gb).to.exist;
        expect(originalConfig.gb.timeout).to.be.a('number');
      }
    });

    it('should have AWS configuration', function() {
      if (originalConfig.providers.includes('aws')) {
        expect(originalConfig.aws).to.exist;
        expect(originalConfig.aws.timeout).to.be.a('number');
        expect(originalConfig.aws.imageSize).to.exist;
      }
    });

    it('should have Open Library configuration', function() {
      if (originalConfig.providers.includes('ol')) {
        expect(originalConfig.ol).to.exist;
        expect(originalConfig.ol.timeout).to.be.a('number');
        expect(originalConfig.ol.imageSize).to.exist;
      }
    });

    it('should have ORB configuration if enabled', function() {
      if (originalConfig.providers.includes('orb')) {
        expect(originalConfig.orb).to.exist;
        expect(originalConfig.orb.timeout).to.be.a('number');
        // Note: user and key might not be set in test environment
      }
    });
  });

  describe('Cache configuration', function() {
    it('should have cache configuration if caching is enabled', function() {
      const hasCaching = originalConfig.providers.some(provider => 
        originalConfig[provider] && originalConfig[provider].cache
      );
      
      if (hasCaching) {
        expect(originalConfig.cache).to.exist;
        expect(originalConfig.cache.path).to.exist;
        expect(originalConfig.cache.url).to.exist;
      }
    });
  });

  describe('Configuration validation', function() {
    it('should have consistent provider configurations', function() {
      originalConfig.providers.forEach(provider => {
        expect(originalConfig[provider]).to.exist;
        expect(originalConfig[provider].timeout).to.be.a('number');
      });
    });

    it('should have reasonable timeout values', function() {
      originalConfig.providers.forEach(provider => {
        const timeout = originalConfig[provider].timeout;
        expect(timeout).to.be.greaterThan(1000); // At least 1 second
        expect(timeout).to.be.lessThan(300000); // Less than 5 minutes
      });
    });

    it('should have valid Redis timeout', function() {
      expect(originalConfig.redis.timeout).to.be.greaterThan(0);
      expect(originalConfig.redis.timeout).to.be.lessThan(60000); // Less than 1 minute
    });
  });

  describe('Environment-specific configuration', function() {
    it('should handle missing optional configurations gracefully', function() {
      // ORB credentials might not be set in test environment
      if (originalConfig.providers.includes('orb')) {
        // Should not throw error even if credentials are missing
        expect(() => {
          const orb = originalConfig.orb;
          // Access properties without throwing
          const user = orb.user;
          const key = orb.key;
        }).to.not.throw();
      }
    });
  });
});
