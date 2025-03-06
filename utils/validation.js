/**
 * Validation utilities for load testing
 */

const axios = require('axios');
const config = require('./config');
const validators = require('./validators');

/**
 * Check if the server is alive and reachable
 * @returns {Promise<boolean>} True if server is alive
 */
async function serverAlive() {
  try {
    // Use a longer timeout and multiple retries to check server health
    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.get(`${config.defaultConfig.url}/health`, { 
          timeout: 5000, // Longer timeout for server check
          headers: { 'x-test-check': 'server-alive-check' } // Special header to identify health checks
        });
        if (response.status === 200) {
          return true;
        }
      } catch (err) {
        console.log(`Attempt ${i+1} to check server failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return false;
  } catch (err) {
    console.error('Failed to check server status:', err.message);
    // More generous assumption - assume server is up unless definitively proven down
    return true;
  }
}

/**
 * Retry a fetch request multiple times before giving up
 * @param {string} url The URL to fetch
 * @param {object} options Request options
 * @param {number} retries Number of retries
 * @returns {Promise<object>} The response
 */
async function retryFetch(url, options, retries = config.validation.connectionRetries) {
  try {
    return await axios({
      url,
      method: options.method || 'GET',
      headers: options.headers,
      data: options.body,
      timeout: 8000 // Increased timeout for validation checks
    });
  } catch (error) {
    if (retries <= 0) throw error;
    console.log(`Fetch attempt failed, retrying (${retries} attempts left)...`);
    await new Promise(resolve => setTimeout(resolve, config.validation.retryDelay));
    return retryFetch(url, options, retries - 1);
  }
}

/**
 * Validate a test endpoint before running a full load test
 * @param {object} test The test configuration
 * @returns {Promise<object>} Validation result
 */
async function validateEndpoint(test) {
  if (!config.validation.enabled) return { success: true };
  
  console.log(`\nValidating response for ${test.name} (${test.path})...`);
  
  // First check if the server is reachable - but only once at the beginning of all tests
  // Don't check for every endpoint to avoid overwhelming the server with validation checks
  if (validateEndpoint.checkedServerStatus !== true) {
    validateEndpoint.checkedServerStatus = true;
    
    const isServerUp = await serverAlive();
    if (!isServerUp) {
      console.error('⚠️ Warning: Server health check failed, but continuing with tests. Some endpoints may fail.');
      // We continue anyway, individual endpoints will be checked
    }
  }
  
  try {
    // Prepare headers if there's a setupHeaders function
    const headers = test.setupHeaders 
      ? test.setupHeaders(test.headers || {})
      : test.headers || {};
    
    // Make a single request to validate response format with retries
    const response = await retryFetch(`${test.url}${test.path}`, {
      method: test.method,
      headers,
      body: test.body
    });
    
    if (response.status >= 400) {
      return { 
        success: false, 
        status: response.status,
        error: `Received ${response.status} ${response.statusText}`
      };
    }
    
    const bodyText = JSON.stringify(response.data);
    
    // Get the validator for this path
    const validator = validators[test.path];
    
    if (!validator) {
      console.log(`⚠️ No validator defined for ${test.path}, skipping validation`);
      return { success: true, warning: 'No validator defined' };
    }
    
    const isValid = validator(bodyText);
    
    if (isValid) {
      console.log(`✅ Response validation passed for ${test.name}`);
      return { success: true };
    } else {
      console.error(`❌ Response validation failed for ${test.name}`);
      console.error(`Response: ${bodyText.substring(0, 200)}${bodyText.length > 200 ? '...' : ''}`);
      return { 
        success: false, 
        error: 'Response format does not match expected pattern' 
      };
    }
  } catch (error) {
    console.error(`❌ Error validating endpoint ${test.name}:`, error.message);
    
    // Special case for connection errors (service might be down)
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return { 
        success: false, 
        connectionError: true,
        error: `Connection error: ${error.message}` 
      };
    }
    
    return { success: false, error: error.message };
  }
}
// Initialize static property
validateEndpoint.checkedServerStatus = false;

module.exports = {
  serverAlive,
  retryFetch,
  validateEndpoint
}; 