/**
 * Reporting utilities for load testing
 */

const fs = require('fs');
const path = require('path');
const { writeFileSync } = require('fs');
const config = require('./config');

/**
 * Print results in a readable format
 * @param {object} results Test results from autocannon
 */
function printResults(results) {
  if (!results) return;
  
  console.log('\n===== RESULTS =====');
  console.log(`Requests: ${results.requests?.total || 0}`);
  console.log(`Throughput: ${results.throughput?.average?.toFixed(2) || 0} req/sec`);
  console.log(`Latency (avg): ${results.latency?.average?.toFixed(2) || 0} ms`);
  console.log(`Latency (min): ${results.latency?.min || 0} ms`);
  console.log(`Latency (max): ${results.latency?.max || 0} ms`);
  console.log(`Errors: ${results.errors || 0}`);
  
  // Add validation failures if available
  if (results.validationFailures !== undefined) {
    console.log(`Validation Failures: ${results.validationFailures}`);
  }
  
  // Add status code distribution if available
  if (results.statusCodeStats) {
    console.log('\nStatus Code Distribution:');
    Object.entries(results.statusCodeStats).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }
  
  console.log('===================\n');
}

/**
 * Save test results to a file
 * @param {Array} results Array of test results
 * @param {number} startTime Test start timestamp
 * @returns {string} Path to the saved file
 */
function saveResults(results, startTime) {
  // Create results directory if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Save results to a JSON file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(resultsDir, `load-test-results-${timestamp}.json`);
  writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${filename}`);
  
  return filename;
}

/**
 * Print a summary of all test results
 * @param {Array} results Array of test results
 * @param {number} totalDuration Total test duration in seconds
 */
function printSummary(results, totalDuration) {
  console.log('\n===== TEST SUMMARY =====');
  console.log(`Total tests: ${results.length}`);
  console.log(`Total duration: ${totalDuration} seconds`);
  
  // Count skipped tests
  const skippedTests = results.filter(r => r.skipped).length;
  if (skippedTests > 0) {
    console.log(`Skipped tests: ${skippedTests}`);
  }
  
  console.log('\nEndpoint Performance (by throughput):\n');
  
  // Sort by throughput for the summary (only for tests that weren't skipped)
  results
    .filter(item => !item.skipped)
    .sort((a, b) => {
      if (!a.result?.throughput?.average) return 1;
      if (!b.result?.throughput?.average) return -1;
      return b.result.throughput.average - a.result.throughput.average;
    })
    .forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}):`);
      console.log(`  Throughput: ${item.result.throughput.average.toFixed(2)} req/sec`);
      console.log(`  Latency: ${item.result.latency.average.toFixed(2)} ms`);
      console.log(`  Errors: ${item.result.errors}`);
      if (item.result.validationFailures !== undefined) {
        console.log(`  Validation Failures: ${item.result.validationFailures}`);
      }
      console.log('');
    });
    
  // Show skipped tests
  if (skippedTests > 0) {
    console.log('\nSkipped Tests:\n');
    results
      .filter(item => item.skipped)
      .forEach(item => {
        console.log(`${item.name} (${item.method} ${item.path}): ${item.reason || 'Skipped'}`);
      });
    console.log('');
  }
    
  // Show highest latency endpoints
  console.log('\nSlowest Endpoints (by latency):\n');
  results
    .filter(item => !item.skipped && item.result)
    .sort((a, b) => b.result.latency.average - a.result.latency.average)
    .slice(0, 3)
    .forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}): ${item.result.latency.average.toFixed(2)} ms`);
    });
    
  // Show any endpoints with errors
  const endpointsWithErrors = results.filter(item => !item.skipped && item.result && item.result.errors > 0);
  if (endpointsWithErrors.length > 0) {
    console.log('\nEndpoints with Errors:\n');
    endpointsWithErrors.forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}): ${item.result.errors} errors`);
    });
  }
  
  // Show any endpoints with validation failures
  const endpointsWithValidationFailures = results.filter(
    item => !item.skipped && item.result && item.result.validationFailures > 0
  );
  
  if (config.validation.enabled && endpointsWithValidationFailures.length > 0) {
    console.log('\nEndpoints with Validation Failures:\n');
    endpointsWithValidationFailures.forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}): ${item.result.validationFailures} validation failures`);
    });
  }
}

module.exports = {
  printResults,
  saveResults,
  printSummary
}; 