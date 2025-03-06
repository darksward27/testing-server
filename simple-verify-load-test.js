/**
 * Simplified Load Testing Script
 * 
 * This script focuses on three main functions:
 * 1. Sending requests to all endpoints
 * 2. Verifying the responses are valid
 * 3. Controlling the number of users/requests per second
 */

const { tests } = require('./utils/tests');
const { serverAlive, validateEndpoint } = require('./utils/validation');
const { runTest } = require('./utils/runner');
const { printResults, saveResults, printSummary } = require('./utils/reporting');

// Get user-specified connections parameter from command line
const getUserConnections = () => {
  const connArg = process.argv.find(arg => arg.startsWith('--connections='));
  if (connArg) {
    const connections = parseInt(connArg.split('=')[1]);
    if (!isNaN(connections) && connections > 0) {
      return connections;
    }
  }
  return null; // Use default from test configuration
};

/**
 * Run all tests with response validation
 */
async function runAllTests() {
  console.log('=== SIMPLIFIED LOAD TEST ===');
  console.log('- Sending requests to all endpoints');
  console.log('- Verifying responses are valid');
  console.log('- Results will be saved to ./results folder\n');

  // Always enable response validation
  process.env.VALIDATE_RESPONSES = 'true';
  
  // Check if server is alive
  console.log('Checking server status...');
  const isServerUp = await serverAlive();
  if (!isServerUp) {
    console.error('❌ Server is not responding. Please start the server before running tests.');
    process.exit(1);
  }
  console.log('✅ Server is up and running.\n');

  // Get user-specified connections (users per second)
  const userConnections = getUserConnections();
  
  // Start time for the entire test suite
  const startTime = new Date();
  const results = [];

  // Run each test sequentially with validation
  for (const test of tests) {
    try {
      // Apply user-specified connections if provided
      if (userConnections) {
        console.log(`Using user-specified connections: ${userConnections}`);
        test.connections = userConnections;
      }
      
      // Validate endpoint before running load test
      const validationResult = await validateEndpoint(test);
      if (!validationResult.success) {
        console.error(`❌ Validation failed for ${test.name}: ${validationResult.error}`);
        console.log('Skipping this test and moving to the next one.\n');
        results.push({
          name: test.name,
          path: test.path,
          method: test.method,
          skipped: true,
          reason: 'validation_failed',
          error: validationResult.error
        });
        continue;
      }
      
      // Run the load test
      const result = await runTest(test);
      if (!result.skipped) {
        results.push({
          name: test.name,
          path: test.path,
          method: test.method,
          result,
          skipped: false
        });
        
        // Print individual test results
        printResults(result);
      } else {
        results.push({
          name: test.name,
          path: test.path,
          method: test.method,
          skipped: true,
          reason: result.reason
        });
      }
    } catch (error) {
      console.error(`❌ Error running test ${test.name}:`, error.message);
      results.push({
        name: test.name,
        path: test.path,
        method: test.method,
        error: error.message,
        skipped: true,
        reason: 'error'
      });
    }
  }

  // Calculate total test duration
  const endTime = new Date();
  const totalDuration = (endTime - startTime) / 1000;

  // Save results and print summary
  saveResults(results, startTime);
  printSummary(results, totalDuration);
}

// Run the tests
runAllTests().catch(err => {
  console.error('Failed to run tests:', err);
  process.exit(1);
}); 