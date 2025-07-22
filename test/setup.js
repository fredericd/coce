const chai = require('chai');
const sinon = require('sinon');

// Make chai available globally
global.expect = chai.expect;
global.sinon = sinon;

// Configure chai
chai.config.includeStack = true;

// Suppress console output during tests unless explicitly needed
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

// Only suppress console in test environment
if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

// Restore console after tests if needed
process.on('exit', () => {
  if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  }
});
