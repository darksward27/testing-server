/**
 * Test runner for load testing
 */

const autocannon = require('autocannon');
const config = require('./config');
const { validateEndpoint } = require('./validation');

// Variable to track timeout errors during a test
let timeoutErrors = 0;

/**
 * Middleware function to track rate limiting and errors
 */
const trackRateLimiting = (request, response, error) => {
  // Handle connection errors and timeouts
  if (error) {
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      timeoutErrors++;
      
      // Log periodic updates rather than for every error
      if (timeoutErrors % 10 === 0) {
        process.stderr.write(`\n⚠️ ${timeoutErrors} timeout errors encountered`);
      }
      
      // Skip to next test if we hit too many timeouts
      if (timeoutErrors >= config.errorThresholds.maxTimeoutErrors) {
        process.stderr.write(`\n\n⚠️ Too many timeout errors (${timeoutErrors}), moving to next test\n`);
        return true; // Signal to stop the test
      }
    } else {
      // For other connection errors, just note them but continue
      if (typeof error === 'object' && error.code) {
        process.stderr.write(`\n⚠️ Connection error: ${error.code}`);
      }
    }
    return false;
  }
  
  // Track status code errors
  if (response && response.statusCode >= 400) {
    // Specifically track rate limit errors
    if (response.statusCode === 429) {
      process.stderr.write(`\n⚠️ Rate limit (429) error encountered`);
      return config.rateLimiting.stopOnError; // Stop test only if configured to do so
    } 
    else if (response.statusCode === 500) {
      // For server errors, add a specific warning
      process.stderr.write(`\n⚠️ Server error (500) detected`);
    }
  }
  return false;
};

/**
 * Run a load test for a specific endpoint
 * @param {object} test The test configuration
 * @returns {Promise<object>} Test results
 */
async function runTest(test) {
  return new Promise(async (resolve) => {
    if (test.skipIf && test.skipIf()) {
      console.log(`\nSkipping test: ${test.name} (condition not met)`);
      return resolve({ skipped: true, reason: 'condition_not_met' });
    }
    
    // Reset timeout errors counter for each test
    timeoutErrors = 0;
    
    // Validate the endpoint response before running the load test
    if (config.validation.enabled) {
      const validationResult = await validateEndpoint(test);
      
      // Connection error but server might be up (endpoint issue)
      if (validationResult.connectionError) {
        console.log(`\nCould not connect to endpoint: ${test.name} (${validationResult.error})`);
        
        if (config.validation.skipOnFailure) {
          console.log(`Skipping test due to connection error.`);
          return resolve({
            skipped: true,
            reason: 'connection_error',
            error: validationResult.error
          });
        } else {
          console.log(`Continuing with test despite connection error (validation not strict).`);
        }
      }
      
      // Other validation failure (wrong response format)
      else if (!validationResult.success && config.validation.skipOnFailure) {
        console.log(`\nSkipping test: ${test.name} (validation failed: ${validationResult.error})`);
        return resolve({
          skipped: true,
          reason: 'validation_failed',
          error: validationResult.error
        });
      }
    }
    
    console.log(`\nStarting test: ${test.name}`);
    console.log(`URL: ${test.url}${test.path}`);
    console.log(`Method: ${test.method}`);
    console.log(`Connections: ${test.connections}, Duration: ${test.duration}s\n`);

    // Set up headers if needed
    const headers = test.setupHeaders ? test.setupHeaders(test.headers || {}) : test.headers;

    // Create the test instance
    const instance = autocannon({
      ...config.defaultConfig,
      ...test,
      headers,
      setupClient: test.setupFn,
      // Add our tracking middleware
      requests: test.requests || [
        {
          method: test.method,
          path: test.path,
          body: test.body,
          onResponse: trackRateLimiting
        }
      ]
    });

    // Set up hooks to manage errors
    instance.on('error', (err) => {
      console.error(`\n❌ Test error: ${err.message}`);
    });

    // Print progress updates
    autocannon.track(instance, { renderProgressBar: true });

    instance.on('done', (results) => {
      console.log(`\nTest completed: ${test.name}`);
      
      // Add custom field for validation failures if we're using validation
      if (config.validation.enabled && results.customStats) {
        results.validationFailures = results.customStats.validationFailures || 0;
      }
      
      resolve(results);
    });
  });
}

module.exports = {
  runTest,
  trackRateLimiting
}; 