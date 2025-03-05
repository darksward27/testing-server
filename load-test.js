const autocannon = require('autocannon');
const { writeFileSync } = require('fs');
const path = require('path');
const fs = require('fs');

// Default test configuration
const defaultConfig = {
  url: 'http://localhost:3000',
  connections: 100,      // Number of concurrent connections
  duration: 10,          // Duration of the test in seconds
  pipelining: 1,         // Number of requests to pipeline
  timeout: 5,           // Timeout for each request in seconds
};

// Optional authentication token for authenticated endpoints
let authToken = null;

// Test suite for different endpoints
const tests = [
  {
    name: 'Health Check',
    path: '/health',
    method: 'GET',
    ...defaultConfig,
    // Health checks can handle more concurrent users
    connections: 200,
  },
  {
    name: 'Login (Authentication)',
    path: '/api/login',
    method: 'POST',
    body: JSON.stringify({
      username: 'user1',
      password: 'password123'
    }),
    headers: {
      'content-type': 'application/json'
    },
    ...defaultConfig,
    // Store auth token from response for later tests
    setupFn: async (client) => {
      try {
        // Do a manual request to get the auth token
        const response = await fetch(`${defaultConfig.url}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'user1', password: 'password123' })
        });
        const data = await response.json();
        authToken = data.token;
        console.log('Authentication token obtained for subsequent tests');
      } catch (err) {
        console.error('Failed to obtain auth token:', err.message);
      }
      return client;
    },
  },
  {
    name: 'Get Products (Cached Data)',
    path: '/api/products',
    method: 'GET',
    ...defaultConfig,
    // Cached data can handle more concurrent users
    connections: 150,
  },
  {
    name: 'Get Single Product',
    path: '/api/products/1',
    method: 'GET',
    ...defaultConfig,
  },
  {
    name: 'Weather API (External API Call)',
    path: '/api/weather/London',
    method: 'GET',
    ...defaultConfig,
    // External API calls might need more timeout
    timeout: 10,
  },
  {
    name: 'Database Intensive Queries',
    path: '/api/db-intensive?queries=20',
    method: 'GET',
    ...defaultConfig,
    connections: 50, // Lower connections for DB intensive operations
  },
  {
    name: 'CPU Intensive (Medium Workload)',
    path: '/api/cpu-intensive?workload=200',
    method: 'GET',
    ...defaultConfig,
    // Lower connections for CPU-intensive tasks
    connections: 50,
  },
  {
    name: 'Memory Intensive (Small)',
    path: '/api/memory-intensive?size=1',
    method: 'GET',
    ...defaultConfig,
    // Fewer connections for memory-intensive tasks
    connections: 50,
  },
  {
    name: 'Memory Intensive (Large)',
    path: '/api/memory-intensive?size=10',
    method: 'GET',
    ...defaultConfig,
    // Much fewer connections for large memory usage
    connections: 20,
  },
  {
    name: 'User Profile (Authenticated)',
    path: '/api/profile',
    method: 'GET',
    setupHeaders: (headers) => {
      return {
        ...headers,
        'Authorization': `Bearer ${authToken}`
      };
    },
    ...defaultConfig,
    // Skip if no auth token is available
    skipIf: () => !authToken,
  },
  {
    name: 'Checkout Process (Complex Logic)',
    path: '/api/checkout',
    method: 'POST',
    setupHeaders: (headers) => {
      return {
        ...headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };
    },
    body: JSON.stringify({
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 }
      ],
      shippingAddress: {
        street: '123 Test St',
        city: 'Testville',
        state: 'TS',
        zip: '12345'
      },
      paymentMethod: 'credit_card'
    }),
    ...defaultConfig,
    // Complex logic needs fewer connections
    connections: 30,
    // Skip if no auth token is available
    skipIf: () => !authToken,
  }
];

// Function to run a specific test
function runTest(test) {
  return new Promise((resolve) => {
    if (test.skipIf && test.skipIf()) {
      console.log(`\nSkipping test: ${test.name} (condition not met)`);
      return resolve(null);
    }
    
    console.log(`\nStarting test: ${test.name}`);
    console.log(`URL: ${test.url}${test.path}`);
    console.log(`Method: ${test.method}`);
    console.log(`Connections: ${test.connections}, Duration: ${test.duration}s\n`);

    // Prepare headers if there's a setupHeaders function
    const headers = test.setupHeaders ? test.setupHeaders(test.headers || {}) : test.headers;

    const instance = autocannon({
      url: `${test.url}${test.path}`,
      connections: test.connections,
      duration: test.duration,
      pipelining: test.pipelining,
      timeout: test.timeout,
      method: test.method,
      headers,
      body: test.body,
      setupClient: test.setupFn,
    });

    // Print progress updates
    autocannon.track(instance, { renderProgressBar: true });

    instance.on('done', (results) => {
      console.log(`\nTest completed: ${test.name}`);
      printResults(results);
      resolve(results);
    });
  });
}

// Print results in a readable format
function printResults(results) {
  if (!results) return;
  
  console.log('\n===== RESULTS =====');
  console.log(`Requests: ${results.requests.total}`);
  console.log(`Throughput: ${results.throughput.average.toFixed(2)} req/sec`);
  console.log(`Latency (avg): ${results.latency.average.toFixed(2)} ms`);
  console.log(`Latency (min): ${results.latency.min} ms`);
  console.log(`Latency (max): ${results.latency.max} ms`);
  console.log(`Errors: ${results.errors}`);
  
  // Add status code distribution if available
  if (results.statusCodeStats) {
    console.log('\nStatus Code Distribution:');
    Object.entries(results.statusCodeStats).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }
  
  console.log('===================\n');
}

// Main function to run all tests in sequence
async function runAllTests() {
  console.log('=== SERVER LOAD TESTING ===');
  console.log('Make sure the server is running before starting tests');
  console.log('Run: node server/index.js in a separate terminal');
  
  const results = [];
  const startTime = Date.now();
  
  // Create results directory if it doesn't exist
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Run each test sequentially
  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      results.push({
        name: test.name,
        path: test.path,
        method: test.method,
        connections: test.connections,
        result
      });
    }
  }
  
  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Save results to a JSON file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(resultsDir, `load-test-results-${timestamp}.json`);
  writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${filename}`);
  
  // Print summary
  console.log('\n===== TEST SUMMARY =====');
  console.log(`Total tests: ${results.length}`);
  console.log(`Total duration: ${totalDuration} seconds`);
  console.log('\nEndpoint Performance (by throughput):\n');
  
  // Sort by throughput for the summary
  results
    .sort((a, b) => b.result.throughput.average - a.result.throughput.average)
    .forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}):`);
      console.log(`  Throughput: ${item.result.throughput.average.toFixed(2)} req/sec`);
      console.log(`  Latency: ${item.result.latency.average.toFixed(2)} ms`);
      console.log(`  Errors: ${item.result.errors}`);
      console.log('');
    });
    
  // Show highest latency endpoints
  console.log('\nSlowest Endpoints (by latency):\n');
  results
    .sort((a, b) => b.result.latency.average - a.result.latency.average)
    .slice(0, 3)
    .forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}): ${item.result.latency.average.toFixed(2)} ms`);
    });
    
  // Show any endpoints with errors
  const endpointsWithErrors = results.filter(item => item.result.errors > 0);
  if (endpointsWithErrors.length > 0) {
    console.log('\nEndpoints with Errors:\n');
    endpointsWithErrors.forEach(item => {
      console.log(`${item.name} (${item.method} ${item.path}): ${item.result.errors} errors`);
    });
  }
}

// Run all tests
runAllTests().catch(console.error); 