/**
 * Server Health Check Script
 * 
 * This script tests the basic functionality of the server
 * to ensure it's running and responding correctly.
 */

const axios = require('axios');
const ora = require('ora');

// Configuration
const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TIMEOUT = 5000; // 5 seconds

// Endpoints to test in sequence
const ENDPOINTS = [
  {
    name: 'Health Check',
    url: `${BASE_URL}/health`,
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data && data.status === 'ok' && typeof data.uptime === 'number'
  },
  {
    name: 'Products List',
    url: `${BASE_URL}/api/products`,
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => Array.isArray(data) && data.length > 0
  },
  {
    name: 'Single Product',
    url: `${BASE_URL}/api/products/1`,
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data && data.id === 1 && data.name
  },
  {
    name: 'Weather API',
    url: `${BASE_URL}/api/weather/London`,
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data && data.city === 'London' && typeof data.temperature === 'number'
  },
  {
    name: 'Authentication',
    url: `${BASE_URL}/api/login`,
    method: 'POST',
    data: { username: 'user1', password: 'password123' },
    expectedStatus: 200,
    validate: (data) => data && data.token && typeof data.token === 'string'
  }
];

// Function to test a single endpoint
async function testEndpoint(endpoint) {
  const spinner = ora(`Testing ${endpoint.name}...`).start();
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      data: endpoint.data,
      timeout: TIMEOUT,
      validateStatus: () => true // Don't throw on error status codes
    });
    
    const statusOk = response.status === endpoint.expectedStatus;
    const dataValid = endpoint.validate ? endpoint.validate(response.data) : true;
    
    if (statusOk && dataValid) {
      spinner.succeed(`${endpoint.name} is working correctly (${response.status})`);
      return { success: true, endpoint: endpoint.name };
    } else if (!statusOk) {
      spinner.fail(`${endpoint.name} returned status ${response.status}, expected ${endpoint.expectedStatus}`);
      return { 
        success: false, 
        endpoint: endpoint.name, 
        error: `Unexpected status code: ${response.status}` 
      };
    } else {
      spinner.fail(`${endpoint.name} response validation failed`);
      return { 
        success: false, 
        endpoint: endpoint.name, 
        error: 'Response validation failed',
        data: JSON.stringify(response.data).substring(0, 100)
      };
    }
  } catch (error) {
    const errorMessage = error.code === 'ECONNREFUSED' 
      ? 'Connection refused - server may not be running'
      : error.code === 'ETIMEDOUT'
        ? 'Connection timed out'
        : error.message;
        
    spinner.fail(`${endpoint.name} failed: ${errorMessage}`);
    return { 
      success: false, 
      endpoint: endpoint.name, 
      error: errorMessage 
    };
  }
}

// Main function to test all endpoints
async function checkServer() {
  console.log('\n=== SERVER HEALTH CHECK ===\n');
  console.log(`Testing server at: ${BASE_URL}\n`);
  
  const results = [];
  
  // Test each endpoint in sequence
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // If we can't even connect to the server, stop testing further endpoints
    if (result.error && (
      result.error.includes('Connection refused') || 
      result.error.includes('Connection timed out')
    )) {
      console.log('\n❌ Server connection failed, stopping further tests');
      break;
    }
  }
  
  // Calculate results
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Successful: ${successful}/${total} endpoints`);
  
  if (successful === 0) {
    console.log('\n❌ SERVER IS NOT RUNNING OR HAS CRITICAL FAILURES');
    console.log('Please start the server with: npm start');
  } else if (successful < total) {
    console.log('\n⚠️ SERVER IS RUNNING BUT HAS SOME ISSUES');
    console.log('Failed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.endpoint}: ${r.error}`);
    });
  } else {
    console.log('\n✅ SERVER IS RUNNING CORRECTLY');
    console.log('All endpoints are responding as expected');
  }
  
  return {
    success: successful === total,
    partialSuccess: successful > 0 && successful < total,
    failed: successful === 0,
    results
  };
}

// Run the check if this script is executed directly
if (require.main === module) {
  checkServer()
    .catch(error => {
      console.error('Error running server check:', error);
      process.exit(1);
    });
} else {
  // Export for use in other scripts
  module.exports = {
    checkServer
  };
} 