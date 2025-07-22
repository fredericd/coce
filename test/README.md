# Coce Test Suite

This directory contains comprehensive tests for the Coce cover image cache service. The tests are designed to run both locally and in CI environments without requiring external service dependencies.

## Test Structure

```
test/
├── setup.js                 # Global test setup and configuration
├── fixtures/
│   └── responses.js         # Mock responses from external providers
├── unit/
│   ├── coce-fetcher.test.js # Unit tests for CoceFetcher class
│   └── config.test.js       # Configuration validation tests
└── integration/
    ├── app.test.js          # Express app integration tests
    ├── redis.test.js        # Redis integration tests
    └── performance.test.js  # Performance and edge case tests
```

## Test Categories

### Unit Tests
- **CoceFetcher**: Tests the core fetching logic with mocked HTTP requests
- **Configuration**: Validates configuration loading and structure
- **Individual Providers**: Tests each provider (Google Books, Amazon, Open Library, ORB) separately

### Integration Tests
- **Express App**: Tests the REST API endpoints with mocked external services
- **Redis Integration**: Tests caching behavior with Redis mock
- **Performance**: Tests with large datasets and concurrent requests
- **Error Scenarios**: Tests error handling and recovery

## Mocking Strategy

The tests use comprehensive mocking to avoid external dependencies:

- **HTTP Requests**: Mocked using `nock` to simulate provider responses
- **Redis**: Mocked using `redis-mock` for consistent behavior
- **File System**: Uses temporary directories for cache testing
- **Network Errors**: Simulated connection failures and timeouts

## Running Tests

### Local Development

```bash
# Install dependencies (including test dependencies)
npm install

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
VERBOSE_TESTS=1 npm test
```

### CI Environment

Tests are configured to run automatically in GitHub Actions with:
- Multiple Node.js versions (16.x, 18.x, 20.x)
- Multiple Redis versions (6, 7)
- Both with and without Redis service

## Test Configuration

### Environment Variables

- `NODE_ENV=test`: Enables test mode
- `VERBOSE_TESTS=1`: Shows console output during tests
- `REDIS_HOST`: Redis host for integration tests
- `REDIS_PORT`: Redis port for integration tests

### Mock Responses

Test fixtures in `fixtures/responses.js` contain realistic mock responses from:
- Google Books API
- Open Library API
- ORB API
- Amazon image service

## Test Scenarios Covered

### Happy Path
- ✅ Successful cover fetching from all providers
- ✅ Multiple ISBN handling
- ✅ Cache hit/miss scenarios
- ✅ Different response formats (JSON, JSONP)

### Error Handling
- ✅ Network connection failures
- ✅ HTTP error responses (404, 500, etc.)
- ✅ Malformed JSON responses
- ✅ Provider timeouts
- ✅ Invalid input validation

### Edge Cases
- ✅ Large ISBN lists (50+ items)
- ✅ Concurrent requests
- ✅ Special characters in ISBNs
- ✅ Empty responses from providers
- ✅ Memory usage with large responses

### Performance
- ✅ Response time under load
- ✅ Memory leak detection
- ✅ Concurrent request handling
- ✅ Cache efficiency

## Adding New Tests

### For New Providers

1. Add mock responses to `fixtures/responses.js`
2. Add provider-specific tests to `coce-fetcher.test.js`
3. Update integration tests in `app.test.js`

### For New Features

1. Add unit tests for the core logic
2. Add integration tests for API endpoints
3. Add performance tests if applicable
4. Update fixtures if new external calls are made

### Test Naming Convention

- Describe blocks: Use clear, descriptive names
- Test cases: Start with "should" followed by expected behavior
- Use nested describe blocks for logical grouping

Example:
```javascript
describe('Google Books Provider', function() {
  describe('successful responses', function() {
    it('should fetch covers successfully', function() {
      // test implementation
    });
  });
  
  describe('error handling', function() {
    it('should handle network errors gracefully', function() {
      // test implementation
    });
  });
});
```

## Debugging Tests

### Common Issues

1. **Nock not matching requests**: Check URL patterns and query parameters
2. **Redis mock not working**: Ensure Redis is mocked before requiring modules
3. **Timeouts**: Increase timeout for slow tests or CI environments
4. **Memory leaks**: Use `--expose-gc` flag and call `global.gc()` in tests

### Debug Commands

```bash
# Run specific test file
npx mocha test/unit/coce-fetcher.test.js

# Run tests matching pattern
npx mocha test/**/*.test.js --grep "Google Books"

# Run with debugging
node --inspect-brk ./node_modules/.bin/mocha test/**/*.test.js

# Check for memory leaks
node --expose-gc ./node_modules/.bin/mocha test/**/*.test.js
```

## Coverage

To generate test coverage reports:

```bash
# Install nyc if not already installed
npm install --save-dev nyc

# Run tests with coverage
npm run test:coverage

# Generate HTML coverage report
npx nyc report --reporter=html
```

## Continuous Integration

The test suite is configured to run on:
- Every push to main/master/develop branches
- Every pull request
- Multiple Node.js and Redis versions
- Both Ubuntu and potentially other OS environments

Tests must pass on all configurations before code can be merged.

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Mocking**: Mock all external dependencies consistently
3. **Assertions**: Use clear, specific assertions
4. **Cleanup**: Restore mocks and clean up after each test
5. **Performance**: Keep tests fast by using appropriate timeouts
6. **Documentation**: Document complex test scenarios

## Troubleshooting

### Common Test Failures

1. **"Nock: No match for request"**: 
   - Check if the HTTP request URL/method matches the mock
   - Verify query parameters and headers

2. **"Redis connection failed"**:
   - Ensure redis-mock is properly configured
   - Check if Redis service is running in CI

3. **"Test timeout"**:
   - Increase timeout for slow operations
   - Check for unresolved promises or callbacks

4. **"Module not found"**:
   - Ensure all test dependencies are installed
   - Check require paths in test files
