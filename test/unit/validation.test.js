const { expect } = require('chai');
const { validateIds, validateProviders, isValidIsbnFormat } = require('../../lib/validation');

describe('Validation Module', function() {
  
  describe('validateIds', function() {
    
    describe('Basic validation', function() {
      it('should reject missing ID parameter', function() {
        const result = validateIds();
        expect(result.valid).to.be.false;
        expect(result.error).to.include('ID parameter is required');
      });

      it('should reject null ID parameter', function() {
        const result = validateIds(null);
        expect(result.valid).to.be.false;
        expect(result.error).to.include('ID parameter is required');
      });

      it('should reject non-string ID parameter', function() {
        const result = validateIds(123);
        expect(result.valid).to.be.false;
        expect(result.error).to.include('ID parameter is required');
      });

      it('should reject empty string', function() {
        const result = validateIds('');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('ID parameter is required');
      });

      it('should reject string too short', function() {
        const result = validateIds('123');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('ID parameter must be at least 8 characters');
      });

      it('should reject empty ID list after parsing', function() {
        const result = validateIds(',,,   ,  ,');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('At least one valid ID is required');
      });
    });

    describe('ISBN-10 validation', function() {
      it('should accept valid ISBN-10', function() {
        const result = validateIds('0415480639');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['0415480639']);
      });

      it('should accept X-ended ISBN-10', function() {
        const result = validateIds('275403143X');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['275403143X']);
      });

      it('should accept ISBN-10 with hyphens', function() {
        const result = validateIds('0-415-48063-9');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['0-415-48063-9']);
      });

      it('should accept ISBN-10 with spaces', function() {
        const result = validateIds('0 415 48063 9');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['0 415 48063 9']);
      });

      it('should accept multiple X-ended ISBN-10s', function() {
        const result = validateIds('275403143X,123456789X');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['275403143X', '123456789X']);
      });
    });

    describe('ISBN-13 validation', function() {
      it('should accept valid ISBN-13', function() {
        const result = validateIds('9780415480635');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['9780415480635']);
      });

      it('should accept ISBN-13 with hyphens', function() {
        const result = validateIds('978-0-415-48063-5');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['978-0-415-48063-5']);
      });

      it('should reject ISBN-13 with X (invalid format)', function() {
        const result = validateIds('978041548063X');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('Invalid ID format');
        expect(result.error).to.include('978041548063X');
      });
    });

    describe('Mixed ID formats', function() {
      it('should accept mixed valid ISBN formats', function() {
        const result = validateIds('275403143X,9780415480635,0821417492');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['275403143X', '9780415480635', '0821417492']);
      });

      it('should accept alphanumeric IDs', function() {
        const result = validateIds('ABC123DEF456');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['ABC123DEF456']);
      });

      it('should reject invalid characters', function() {
        const result = validateIds('invalid-isbn!@#');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('Invalid ID format');
      });

      it('should report multiple invalid IDs', function() {
        const result = validateIds('invalid!,bad@format,275403143X,another#bad');
        expect(result.valid).to.be.false;
        expect(result.error).to.include('Invalid ID format');
        expect(result.error).to.include('invalid!');
        expect(result.error).to.include('bad@format');
      });

      it('should limit error message to 5 invalid IDs', function() {
        const invalidIds = Array(10).fill('bad!').join(',');
        const result = validateIds(invalidIds);
        expect(result.valid).to.be.false;
        expect(result.error).to.include('...');
      });
    });

    describe('Edge cases', function() {
      it('should handle whitespace in comma-separated list', function() {
        const result = validateIds(' 275403143X , 9780415480635 , 0821417492 ');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal([' 275403143X ', ' 9780415480635 ', ' 0821417492 ']);
      });

      it('should filter out empty entries', function() {
        const result = validateIds('275403143X,,9780415480635,');
        expect(result.valid).to.be.true;
        expect(result.ids).to.deep.equal(['275403143X', '9780415480635']);
      });
    });
  });

  describe('validateProviders', function() {
    const availableProviders = ['gb', 'aws', 'ol', 'orb'];

    it('should return default providers when none specified', function() {
      const result = validateProviders(undefined, availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(availableProviders);
    });

    it('should return default providers for null input', function() {
      const result = validateProviders(null, availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(availableProviders);
    });

    it('should reject non-string provider parameter', function() {
      const result = validateProviders(123, availableProviders);
      expect(result.valid).to.be.false;
      expect(result.error).to.include('Provider parameter must be a string');
    });

    it('should accept valid single provider', function() {
      const result = validateProviders('gb', availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(['gb']);
    });

    it('should accept valid multiple providers', function() {
      const result = validateProviders('gb,aws,ol', availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(['gb', 'aws', 'ol']);
    });

    it('should reject invalid provider', function() {
      const result = validateProviders('invalid', availableProviders);
      expect(result.valid).to.be.false;
      expect(result.error).to.include('Invalid providers: invalid');
      expect(result.error).to.include('Available: gb, aws, ol, orb');
    });

    it('should reject multiple invalid providers', function() {
      const result = validateProviders('invalid1,invalid2', availableProviders);
      expect(result.valid).to.be.false;
      expect(result.error).to.include('Invalid providers: invalid1, invalid2');
    });

    it('should handle mixed valid and invalid providers', function() {
      const result = validateProviders('gb,invalid,aws', availableProviders);
      expect(result.valid).to.be.false;
      expect(result.error).to.include('Invalid providers: invalid');
    });

    it('should handle empty provider list', function() {
      const result = validateProviders('', availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(availableProviders);
    });

    it('should filter out empty entries', function() {
      const result = validateProviders('gb,,aws,', availableProviders);
      expect(result.valid).to.be.true;
      expect(result.providers).to.deep.equal(['gb', 'aws']);
    });
  });

  describe('isValidIsbnFormat', function() {
    
    describe('ISBN-10 format', function() {
      it('should accept valid ISBN-10', function() {
        expect(isValidIsbnFormat('0415480639')).to.be.true;
      });

      it('should accept X-ended ISBN-10', function() {
        expect(isValidIsbnFormat('275403143X')).to.be.true;
      });

      it('should accept ISBN-10 with hyphens', function() {
        expect(isValidIsbnFormat('0-415-48063-9')).to.be.true;
      });

      it('should accept ISBN-10 with spaces', function() {
        expect(isValidIsbnFormat('0 415 48063 9')).to.be.true;
      });
    });

    describe('ISBN-13 format', function() {
      it('should accept valid ISBN-13', function() {
        expect(isValidIsbnFormat('9780415480635')).to.be.true;
      });

      it('should accept ISBN-13 with hyphens', function() {
        expect(isValidIsbnFormat('978-0-415-48063-5')).to.be.true;
      });

      it('should reject ISBN-13 with X', function() {
        expect(isValidIsbnFormat('978041548063X')).to.be.false;
      });
    });

    describe('Other ID formats', function() {
      it('should accept alphanumeric IDs', function() {
        expect(isValidIsbnFormat('ABC123DEF456')).to.be.true;
      });

      it('should accept numeric IDs of various lengths', function() {
        expect(isValidIsbnFormat('12345')).to.be.true;
        expect(isValidIsbnFormat('123456789012345')).to.be.true;
      });
    });

    describe('Invalid formats', function() {
      it('should reject null/undefined', function() {
        expect(isValidIsbnFormat(null)).to.be.false;
        expect(isValidIsbnFormat(undefined)).to.be.false;
      });

      it('should reject non-string input', function() {
        expect(isValidIsbnFormat(123)).to.be.false;
        expect(isValidIsbnFormat({})).to.be.false;
      });

      it('should reject empty string', function() {
        expect(isValidIsbnFormat('')).to.be.false;
      });

      it('should reject special characters', function() {
        expect(isValidIsbnFormat('123!@#456')).to.be.false;
        expect(isValidIsbnFormat('invalid-isbn')).to.be.false;
      });

      it('should reject ISBN-10 with multiple X characters', function() {
        expect(isValidIsbnFormat('27540314XX')).to.be.false;
      });

      it('should reject X in wrong position for ISBN-10', function() {
        expect(isValidIsbnFormat('X754031439')).to.be.false;
        expect(isValidIsbnFormat('2754X31439')).to.be.false;
      });
    });
  });
});
