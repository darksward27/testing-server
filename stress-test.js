const autocannon = require('autocannon');
const { writeFileSync } = require('fs');
const path = require('path');
const fs = require('fs');
const ora = require('ora');

// Function to run a stress test with increasing connections
async function runStressTest() {
  console.log('=== SERVER STRESS TESTING ===');
  console.log('This test will incrementally increase the number of concurrent connections');
  console.log('until the server starts to degrade significantly.\n');
  console.log('Make sure the server is running before starting tests');
  console.log('Run: node server/index.js in a separate terminal\n');

  // Create results directory if it doesn't exist
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Authentication token for authenticated endpoints
  let authToken = null;

  // Endpoints to test with varying workloads
  const endpointsToTest = [
    {
      name: 'Health Check (Lightweight)',
      path: '/health',
      method: 'GET',
      description: 'Basic endpoint with minimal processing',
      maxConnections: 20000,
    },
    {
      name: 'Products Listing (Cached Data)',
      path: '/api/products',
      method: 'GET',
      description: 'Endpoint with in-memory caching',
      maxConnections: 10000,
    },
    {
      name: 'Single Product (Database Query)',
      path: '/api/products/1',
      method: 'GET',
      description: 'Simple database record lookup',
      maxConnections: 8000,
    },
    {
      name: 'Database Operations (Multiple Queries)',
      path: '/api/db-intensive?queries=10',
      method: 'GET',
      description: 'Multiple simulated database operations',
      maxConnections: 5000,
    },
    {
      name: 'CPU Intensive (Low Workload)',
      path: '/api/cpu-intensive?workload=50',
      method: 'GET',
      description: 'CPU bound task with low processing requirements',
      maxConnections: 3000,
    },
    {
      name: 'CPU Intensive (High Workload)',
      path: '/api/cpu-intensive?workload=300',
      method: 'GET',
      description: 'CPU bound task with high processing requirements',
      maxConnections: 1000,
    },
    {
      name: 'Memory Intensive (Small)',
      path: '/api/memory-intensive?size=1',
      method: 'GET',
      description: 'Memory allocation of 1MB per request',
      maxConnections: 2000,
    },
    {
      name: 'External API Call (Weather)',
      path: '/api/weather/London',
      method: 'GET',
      description: 'Simulated external API call with latency',
      maxConnections: 5000,
    }
  ];

  const authEndpoint = {
    name: 'Authentication',
    path: '/api/login',
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      username: 'user1',
      password: 'password123'
    }),
    description: 'User authentication with JWT token generation',
    maxConnections: 5000
  };

  // Add authentication endpoint first
  endpointsToTest.unshift(authEndpoint);

  // Authenticated endpoints to test (will be skipped if auth fails)
  const authEndpointsToTest = [
    {
      name: 'User Profile (Authenticated)',
      path: '/api/profile',
      method: 'GET',
      setupHeaders: (headers) => ({ ...headers, 'Authorization': `Bearer ${authToken}` }),
      description: 'Protected endpoint requiring authentication',
      maxConnections: 3000,
    },
    {
      name: 'Checkout Process (Authenticated)',
      path: '/api/checkout',
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      setupHeaders: (headers) => ({ ...headers, 'Authorization': `Bearer ${authToken}` }),
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
      description: 'Complex business logic with authentication',
      maxConnections: 2000,
    }
  ];

  // Base URL
  const baseUrl = 'http://localhost:3000';
  
  // Common test configuration
  const defaultDuration = 10; // seconds per test
  
  // Starting with a modest number of connections and gradually increasing
  // Using a more granular progression at lower connection counts
  const baseConnectionLevels = [
    10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 7500, 10000, 15000, 20000
  ];
  
  // Store all results
  const allResults = [];
  const endpointSummaries = [];
  
  // Try to get an auth token first
  console.log('\n🔑 Getting authentication token for protected endpoints...');
  try {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user1', password: 'password123' })
    });
    
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
      console.log('✅ Authentication successful, token obtained\n');
      
      // Add authenticated endpoints to the test queue
      endpointsToTest.push(...authEndpointsToTest);
    } else {
      console.log('❌ Authentication failed, skipping authenticated endpoints\n');
    }
  } catch (err) {
    console.log('❌ Authentication request failed, skipping authenticated endpoints\n');
  }

  // Test each endpoint
  for (const endpoint of endpointsToTest) {
    console.log(`\n=====================================================`);
    console.log(`📋 TESTING ENDPOINT: ${endpoint.name}`);
    console.log(`📝 Description: ${endpoint.description}`);
    console.log(`🔗 ${endpoint.method} ${endpoint.path}`);
    console.log(`=====================================================\n`);
    
    // Filter connection levels based on endpoint's maxConnections
    const connectionLevels = baseConnectionLevels.filter(level => level <= endpoint.maxConnections);
    
    const endpointResults = [];
    let previousThroughput = 0;
    let degradationPoint = null;
    let errorRateThreshold = false;
    let latencyThreshold = false;
    
    // For each connection level
    for (const connections of connectionLevels) {
      if (degradationPoint && connections > degradationPoint * 2) {
        console.log(`⏩ Skipping ${connections} connections as significant degradation already detected`);
        continue;
      }
      
      if (errorRateThreshold || latencyThreshold) {
        console.log(`⏩ Skipping ${connections} connections as error rate or latency exceeded thresholds`);
        continue;
      }
      
      console.log(`\n🔄 Running test with ${connections} concurrent connections...`);
      
      // Prepare headers if there's a setupHeaders function
      const headers = endpoint.setupHeaders 
        ? endpoint.setupHeaders(endpoint.headers || {})
        : endpoint.headers;
      
      // Run the test
      const instance = autocannon({
        url: `${baseUrl}${endpoint.path}`,
        connections,
        duration: defaultDuration,
        timeout: 10,
        method: endpoint.method,
        headers,
        body: endpoint.body,
      });
      
      const spinner = ora('Running test...').start();
      
      const result = await new Promise(resolve => {
        instance.on('done', resolve);
      });
      
      spinner.succeed(`Test completed: ${connections} connections`);
      
      // Calculate performance metrics
      const currentThroughput = result.throughput.average;
      const errorRate = result.errors / (result.requests.total || 1);
      const avgLatency = result.latency.average;
      const p95Latency = result.latency.p95;
      
      console.log('\n===== RESULTS =====');
      console.log(`Connections: ${connections}`);
      console.log(`Throughput: ${currentThroughput.toFixed(2)} req/sec`);
      console.log(`Latency (avg): ${avgLatency.toFixed(2)} ms`);
      console.log(`Latency (p95): ${p95Latency.toFixed(2)} ms`);
      console.log(`Error rate: ${(errorRate * 100).toFixed(2)}%`);
      
      if (result.statusCodeStats) {
        console.log('\nStatus Code Distribution:');
        Object.entries(result.statusCodeStats).forEach(([code, count]) => {
          console.log(`  ${code}: ${count}`);
        });
      }
      
      console.log('===================\n');
      
      // Store the results
      endpointResults.push({
        connections,
        throughput: currentThroughput,
        latency: avgLatency,
        p95Latency,
        errorRate,
        errors: result.errors,
        timeouts: result.timeouts,
        statusCodes: result.statusCodeStats || {},
        non2xx: result.non2xx,
      });
      
      // Check for degradation conditions
      const throughputDegradation = previousThroughput > 0 && currentThroughput < previousThroughput * 0.8;
      const highErrorRate = errorRate > 0.05; // 5% error rate
      const highLatency = avgLatency > 1000;  // 1 second average latency
      
      // Mark degradation point if any condition is met
      if (throughputDegradation || highErrorRate || highLatency) {
        if (!degradationPoint) {
          degradationPoint = connections;
          console.log(`\n⚠️ Performance degradation detected at ${connections} connections!`);
          
          if (throughputDegradation) {
            console.log(`   - Throughput dropped by more than 20% from previous level`);
          }
          if (highErrorRate) {
            console.log(`   - Error rate exceeded 5%`);
          }
          if (highLatency) {
            console.log(`   - Average latency exceeded 1000ms`);
          }
          
          console.log('   Continuing tests to confirm degradation pattern...');
        }
      }
      
      // Set threshold flags for severe degradation
      if (errorRate > 0.1) { // 10% error rate
        errorRateThreshold = true;
        console.log('\n⛔ Error rate exceeded 10%. Stopping further tests for this endpoint.');
      }
      
      if (avgLatency > 3000) { // 3 second latency
        latencyThreshold = true;
        console.log('\n⛔ Average latency exceeded 3000ms. Stopping further tests for this endpoint.');
      }
      
      previousThroughput = currentThroughput;
    }
    
    // Analyze the results for this endpoint
    const maxThroughput = Math.max(...endpointResults.map(r => r.throughput));
    const optimalConnectionPoint = endpointResults.find(r => r.throughput === maxThroughput);
    
    const endpointSummary = {
      name: endpoint.name,
      path: endpoint.path,
      method: endpoint.method,
      description: endpoint.description,
      degradationPoint,
      optimalConnections: optimalConnectionPoint ? optimalConnectionPoint.connections : null,
      maxThroughput,
      resultsCount: endpointResults.length,
      results: endpointResults,
    };
    
    endpointSummaries.push(endpointSummary);
    allResults.push(...endpointResults.map(r => ({ ...r, endpoint: endpoint.name, path: endpoint.path, method: endpoint.method })));
    
    // Print endpoint summary
    console.log('\n===== ENDPOINT SUMMARY =====');
    console.log(`Endpoint: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    
    if (degradationPoint) {
      const safeLevel = Math.floor(degradationPoint * 0.7); // 70% of degradation point as safe level
      console.log(`✅ Recommended maximum load: ${safeLevel} concurrent connections`);
      console.log(`⚠️ Performance degradation began at: ${degradationPoint} concurrent connections`);
    } else if (endpointResults.length > 0) {
      const maxTested = endpointResults[endpointResults.length - 1].connections;
      console.log(`✅ No significant degradation detected up to ${maxTested} concurrent connections`);
    }
    
    if (optimalConnectionPoint) {
      console.log(`\n🔎 Optimal performance at ${optimalConnectionPoint.connections} connections:`);
      console.log(`   - Throughput: ${maxThroughput.toFixed(2)} req/sec`);
      console.log(`   - Latency: ${optimalConnectionPoint.latency.toFixed(2)} ms`);
      console.log(`   - Error rate: ${(optimalConnectionPoint.errorRate * 100).toFixed(2)}%`);
    }
    
    console.log('\n');
  }
  
  // Save results to a JSON file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(resultsDir, `stress-test-results-${timestamp}.json`);
  const summaryFilename = path.join(resultsDir, `stress-test-summary-${timestamp}.json`);
  
  writeFileSync(filename, JSON.stringify(allResults, null, 2));
  writeFileSync(summaryFilename, JSON.stringify(endpointSummaries, null, 2));
  
  console.log(`\nResults saved to ${filename}`);
  console.log(`Summary saved to ${summaryFilename}`);
  
  // Generate final analysis across all endpoints
  console.log('\n===== OVERALL SYSTEM CAPACITY ANALYSIS =====');
  
  // Find the endpoint with the lowest degradation point
  const endpointsWithDegradation = endpointSummaries.filter(e => e.degradationPoint);
  
  if (endpointsWithDegradation.length > 0) {
    const bottleneckEndpoint = endpointsWithDegradation.reduce(
      (prev, current) => prev.degradationPoint < current.degradationPoint ? prev : current
    );
    
    console.log(`\n🚧 System Bottleneck: ${bottleneckEndpoint.name}`);
    console.log(`   Path: ${bottleneckEndpoint.method} ${bottleneckEndpoint.path}`);
    console.log(`   Degradation Point: ${bottleneckEndpoint.degradationPoint} connections`);
    console.log(`   Description: ${bottleneckEndpoint.description}`);
    
    // Recommended safe system-wide connection limit (70% of bottleneck)
    const systemLimit = Math.floor(bottleneckEndpoint.degradationPoint * 0.7);
    console.log(`\n🔒 Recommended overall system connection limit: ${systemLimit} concurrent users`);
  } else {
    console.log(`\n✅ No clear bottlenecks detected in tested endpoints`);
    
    // Find the endpoint tested with the highest connections
    const maxTestedConnections = Math.max(...endpointSummaries.map(
      e => e.results.length > 0 ? e.results[e.results.length - 1].connections : 0
    ));
    
    console.log(`   All endpoints handled up to ${maxTestedConnections} concurrent connections successfully`);
    console.log(`   Consider running additional tests with higher connection counts to find limits`);
  }
  
  // Highlight top performing endpoints
  console.log('\n🚀 Endpoints with highest throughput:');
  endpointSummaries
    .sort((a, b) => b.maxThroughput - a.maxThroughput)
    .slice(0, 3)
    .forEach((e, i) => {
      console.log(`   ${i+1}. ${e.name}: ${e.maxThroughput.toFixed(2)} req/sec at ${e.optimalConnections} connections`);
    });
  
  // Provide scaling recommendations
  console.log('\n📈 Scaling Recommendations:');
  
  if (endpointsWithDegradation.length > 0) {
    // Count endpoints by type of bottleneck
    const cpuBound = endpointsWithDegradation.filter(e => e.path.includes('cpu-intensive')).length;
    const memoryBound = endpointsWithDegradation.filter(e => e.path.includes('memory-intensive')).length;
    const dbBound = endpointsWithDegradation.filter(e => e.path.includes('db-intensive')).length;
    const ioBound = endpointsWithDegradation.filter(e => e.path.includes('weather')).length;
    
    if (cpuBound > 0) {
      console.log('   - Consider vertical scaling (more CPU cores) for CPU-bound operations');
    }
    
    if (memoryBound > 0) {
      console.log('   - Consider increasing available memory for memory-intensive operations');
    }
    
    if (dbBound > 0) {
      console.log('   - Consider database optimizations, indexing, or scaling database resources');
    }
    
    if (ioBound > 0) {
      console.log('   - Consider optimizing external API calls or implementing more aggressive caching');
    }
    
    console.log('   - Implement horizontal scaling with a load balancer for overall throughput improvement');
  } else {
    console.log('   - Current system is handling test load well, scale when approaching tested limits');
  }
  
  console.log('\n✅ Stress test completed successfully');
}

// Check if ora is installed, if not, suggest installing it
try {
  require.resolve('ora');
} catch (e) {
  console.error('The "ora" package is required for improved progress display.');
  console.error('Please install it with: npm install ora --save-dev');
  process.exit(1);
}

// Run the stress test
runStressTest().catch(err => {
  console.error('Error during stress test:', err);
  process.exit(1);
}); 