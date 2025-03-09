/**
 * Configuration module for load testing tools
 */

const config = {
  // Default test configuration
  defaultConfig: {
    url: 'http://192.168.0.111:30080',
    connections: 5000,      // Number of concurrent connections
    duration: 10,          // Duration of the test in seconds
    pipelining: 1,         // Number of requests to pipeline
    timeout: 10,           // Increased timeout for each request in seconds
    ignoreConnectionErrors: true, // Ignore connection errors for more resilient testing
    expectStatusCode: [200, 201, 202, 204], // Accept these status codes as success
  },

  // Response validation configuration
  validation: {
    enabled: process.env.VALIDATE_RESPONSES !== 'false', // Default to true
    skipOnFailure: process.env.SKIP_ON_VALIDATION_FAILURE === 'true', // Default to false
    connectionRetries: 3, // Number of times to retry connection during validation
    retryDelay: 1000, // Delay between retries in ms
  },
  
  // Rate limiting detection
  rateLimiting: {
    stopOnError: process.env.STOP_ON_RATE_LIMIT !== 'false', // Default to true
    errorThreshold: 50, // Increased threshold before stopping test
  },
  
  // Error handling thresholds
  errorThresholds: {
    maxTimeoutErrors: 100, // Maximum timeout errors before skipping to next test
    maxEndpointErrors: 10, // Max errors before skipping to the next endpoint
    maxTotalErrors: 50, // Max total errors before stopping the test
  }
};

module.exports = config; 