/**
 * Server Capacity Testing Script
 * 
 * This script:
 * 1. Sends exactly 500 requests to each endpoint
 * 2. Verifies each response is valid
 * 3. Counts only successful responses to measure server capacity
 * 4. Supports testing against a remote server via URL parameter
 */

const { tests } = require('./utils/tests');
const { serverAlive, validateEndpoint } = require('./utils/validation');
const { runTest } = require('./utils/runner');
const { saveResults } = require('./utils/reporting');
const axios = require('axios');

// Fixed number of requests to send
const TOTAL_REQUESTS = 500;

// Get server URL from command line or use default
const getServerUrl = () => {
  const urlArg = process.argv.find(arg => arg.startsWith('--server-url='));
  if (urlArg) {
    return urlArg.split('=')[1];
  }
  return 'http://localhost:3000'; // Default URL
};

/**
 * Print enhanced results focusing on successful responses
 * @param {object} results Test results
 * @param {string} testName Name of the test
 */
function printEnhancedResults(results, testName) {
  if (!results) return;
  
  // Calculate successful responses (total minus errors)
  const totalRequests = results.requests?.total || 0;
  const errors = results.errors || 0;
  const successfulResponses = totalRequests - errors;
  const successRate = totalRequests > 0 ? (successfulResponses / totalRequests * 100).toFixed(2) : 0;
  
  console.log('\n===== CAPACITY TEST RESULTS =====');
  console.log(`Endpoint: ${testName}`);
  console.log(`Requests Sent: ${TOTAL_REQUESTS}`);
  console.log(`Responses Received: ${totalRequests}`);
  console.log(`Successful Responses: ${successfulResponses}`);
  console.log(`Error Responses: ${errors}`);
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Throughput: ${results.throughput?.average?.toFixed(2) || 0} req/sec`);
  console.log(`Latency (avg): ${results.latency?.average?.toFixed(2) || 0} ms`);
  console.log(`Latency (max): ${results.latency?.max || 0} ms`);
  
  // Add status code distribution if available
  if (results.statusCodeStats) {
    console.log('\nStatus Code Distribution:');
    Object.entries(results.statusCodeStats).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }
  
  console.log('==================================\n');
}

/**
 * Run capacity tests with fixed 500 requests
 */
async function runCapacityTests() {
  // Get server URL
  const serverUrl = getServerUrl();
  
  console.log('=== SERVER CAPACITY TEST ===');
  console.log(`- Testing server: ${serverUrl}`);
  console.log(`- Sending exactly ${TOTAL_REQUESTS} requests to each endpoint`);
  console.log('- Counting only successful responses');
  console.log('- Measuring server capacity under load\n');

  // Always enable response validation
  process.env.VALIDATE_RESPONSES = 'true';
  
  // Update server URL in all tests
  tests.forEach(test => {
    test.url = serverUrl;
  });
  
  // Check if server is alive
  console.log('Checking server status...');
  try {
    const healthResponse = await axios.get(`${serverUrl}/health`, { timeout: 5000 });
    if (healthResponse.status !== 200) {
      console.error(`❌ Server returned status ${healthResponse.status}. Please ensure the server is running properly.`);
      process.exit(1);
    }
    console.log('✅ Server is up and running.\n');
  } catch (error) {
    console.error(`❌ Server is not responding at ${serverUrl}. Please ensure the server is running.`);
    console.error(error.message);
    process.exit(1);
  }
  
  // Start time for the entire test suite
  const startTime = new Date();
  const results = [];
  const summaryData = {
    serverUrl,
    endpointCapacity: [],
    totalSuccessfulResponses: 0,
    totalRequestsAttempted: 0,
    overallSuccessRate: 0
  };

  // Run each test with exactly 500 requests
  for (const test of tests) {
    try {
      // Set connections to ensure we send exactly 500 requests
      // For autocannon, we need to configure it to stop after a certain number of requests
      // Note: We set a higher number for connections to ensure we can send all requests quickly
      test.connections = 50; // Use 50 concurrent connections
      test.amount = TOTAL_REQUESTS; // Send exactly 500 requests total
      test.duration = 60; // Set a max duration but the test will likely finish earlier due to 'amount'
      
      console.log(`\nTesting endpoint: ${test.name} (${test.method} ${test.path})`);
      console.log(`Sending ${TOTAL_REQUESTS} requests to ${serverUrl}${test.path}...`);
      
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
        // Calculate success metrics
        const totalRequests = result.requests?.total || 0;
        const errors = result.errors || 0;
        const successfulResponses = totalRequests - errors;
        const successRate = totalRequests > 0 ? (successfulResponses / totalRequests * 100) : 0;
        
        // Update summary data
        summaryData.totalSuccessfulResponses += successfulResponses;
        summaryData.totalRequestsAttempted += TOTAL_REQUESTS;
        summaryData.endpointCapacity.push({
          name: test.name,
          path: test.path,
          method: test.method,
          successfulResponses,
          successRate,
          throughput: result.throughput?.average || 0,
          latency: result.latency?.average || 0
        });
        
        results.push({
          name: test.name,
          path: test.path,
          method: test.method,
          result,
          skipped: false,
          successfulResponses,
          successRate
        });
        
        // Print enhanced results
        printEnhancedResults(result, test.name);
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
  
  // Calculate overall success rate
  summaryData.overallSuccessRate = summaryData.totalRequestsAttempted > 0 
    ? (summaryData.totalSuccessfulResponses / summaryData.totalRequestsAttempted * 100).toFixed(2) 
    : 0;

  // Print overall capacity summary
  console.log('\n===== SERVER CAPACITY SUMMARY =====');
  console.log(`Server: ${serverUrl}`);
  console.log(`Total Test Duration: ${totalDuration.toFixed(2)} seconds`);
  console.log(`Total Requests Attempted: ${summaryData.totalRequestsAttempted}`);
  console.log(`Total Successful Responses: ${summaryData.totalSuccessfulResponses}`);
  console.log(`Overall Success Rate: ${summaryData.overallSuccessRate}%`);
  
  console.log('\nEndpoint Capacity (sorted by success rate):\n');
  summaryData.endpointCapacity
    .sort((a, b) => b.successRate - a.successRate)
    .forEach(endpoint => {
      console.log(`${endpoint.name} (${endpoint.method} ${endpoint.path}):`);
      console.log(`  Successful Responses: ${endpoint.successfulResponses}/${TOTAL_REQUESTS} (${endpoint.successRate.toFixed(2)}%)`);
      console.log(`  Throughput: ${endpoint.throughput.toFixed(2)} req/sec`);
      console.log(`  Latency: ${endpoint.latency.toFixed(2)} ms\n`);
    });
  
  // Save detailed results
  summaryData.rawResults = results;
  saveResults(summaryData, startTime);
}

// Run the capacity tests
runCapacityTests().catch(err => {
  console.error('Failed to run capacity tests:', err);
  process.exit(1);
}); 