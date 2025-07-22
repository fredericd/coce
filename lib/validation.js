/**
 * Input validation utilities for Coce
 */

/**
 * Validates ID parameter and returns parsed result
 * @param {string} ids - Comma-separated list of IDs
 * @returns {Object} - { valid: boolean, error?: string, ids?: Array }
 */
function validateIds(ids) {
  if (!ids || typeof ids !== 'string') {
    return { valid: false, error: 'ID parameter is required' };
  }
  
  const idArray = ids.split(',').filter(id => id.trim().length > 0);
  
  if (idArray.length === 0) {
    return { valid: false, error: 'At least one valid ID is required' };
  }
  
  if (ids.length < 8) {
    return { valid: false, error: 'ID parameter must be at least 8 characters long' };
  }
  
  // Basic ISBN/ID format validation
  const invalidIds = idArray.filter(id => {
    return !isValidIsbnFormat(id);
  });
  
  if (invalidIds.length > 0) {
    return { 
      valid: false, 
      error: `Invalid ID format: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}` 
    };
  }
  
  return { valid: true, ids: idArray };
}

/**
 * Validates provider parameter
 * @param {string} providers - Comma-separated list of providers
 * @param {Array} availableProviders - Array of available provider names
 * @returns {Object} - { valid: boolean, error?: string, providers?: Array }
 */
function validateProviders(providers, availableProviders) {
  if (!providers) {
    return { valid: true, providers: availableProviders };
  }
  
  if (typeof providers !== 'string') {
    return { valid: false, error: 'Provider parameter must be a string' };
  }
  
  const providerArray = providers.split(',').filter(p => p.trim().length > 0);
  
  if (providerArray.length === 0) {
    return { valid: true, providers: availableProviders };
  }
  
  const invalidProviders = providerArray.filter(p => !availableProviders.includes(p));
  
  if (invalidProviders.length > 0) {
    return { 
      valid: false, 
      error: `Invalid providers: ${invalidProviders.join(', ')}. Available: ${availableProviders.join(', ')}` 
    };
  }
  
  return { valid: true, providers: providerArray };
}

/**
 * Validates individual ISBN format
 * @param {string} isbn - Single ISBN to validate
 * @returns {boolean} - true if valid ISBN format
 */
function isValidIsbnFormat(isbn) {
  if (!isbn || typeof isbn !== 'string') {
    return false;
  }
  
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  // ISBN-10: exactly 10 characters, digits 0-9, last can be X
  if (cleanIsbn.length === 10) {
    return /^[0-9]{9}[0-9X]$/.test(cleanIsbn);
  }
  
  // ISBN-13: exactly 13 digits
  if (cleanIsbn.length === 13) {
    return /^[0-9]{13}$/.test(cleanIsbn);
  }
  
  // Other IDs: alphanumeric only, no hyphens or special characters allowed
  // Only allow hyphens/spaces if they result in valid ISBN format after cleaning
  if (isbn.includes('-') || isbn.includes(' ')) {
    // If it contains hyphens/spaces but isn't a valid ISBN length, reject it
    return false;
  }
  
  return /^[A-Za-z0-9]+$/.test(cleanIsbn);
}

module.exports = {
  validateIds,
  validateProviders,
  isValidIsbnFormat
};
