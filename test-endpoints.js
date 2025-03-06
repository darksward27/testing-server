const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:3000';

// Endpoints to test
const endpoints = [
  { name: 'Health Check', url: '/health', method: 'GET' },
  { name: 'Products List', url: '/api/products', method: 'GET' },
  { name: 'Single Product', url: '/api/products/1', method: 'GET' },
  { name: 'Weather API', url: '/api/weather/London', method: 'GET' },
  { 
    name: 'Authentication', 
    url: '/api/login', 
    method: 'POST',
    data: { username: 'user1', password: 'password123' }
  }
];

// Function to test a single endpoint
async function testEndpoint(endpoint) {
  console.log(`Testing ${endpoint.name}...`);
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.url}`,
      data: endpoint.data,
      headers: endpoint.headers,
      timeout: 5000
    });
    
    console.log(`✅ ${endpoint.name}: Status ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}${response.data && JSON.stringify(response.data).length > 100 ? '...' : ''}\n`);
    
    return { success: true, endpoint: endpoint.name, data: response.data };
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${endpoint.name}: Status ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}\n`);
      return { 
        success: false, 
        endpoint: endpoint.name, 
        status: error.response.status,
        error: error.response.data
      };
    } else {
      console.log(`❌ ${endpoint.name}: ${error.message}\n`);
      return { 
        success: false, 
        endpoint: endpoint.name, 
        error: error.message 
      };
    }
  }
}

// Test all endpoints
async function testAllEndpoints() {
  console.log('=== TESTING API ENDPOINTS ===\n');
  
  let authToken = null;
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Store auth token if this was an authentication endpoint
    if (result.success && endpoint.url === '/api/login' && result.data && result.data.token) {
      authToken = result.data.token;
      console.log('Authentication token obtained for subsequent tests\n');
    }
  }
  
  // If we have an auth token, test authenticated endpoints
  if (authToken) {
    console.log('=== TESTING AUTHENTICATED ENDPOINTS ===\n');
    
    const authedEndpoints = [
      { 
        name: 'User Profile', 
        url: '/api/profile', 
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    ];
    
    for (const endpoint of authedEndpoints) {
      const result = await testEndpoint(endpoint);
      results.push(result);
    }
  }
  
  // Print summary
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log('=== TEST SUMMARY ===');
  console.log(`Successful: ${successful}/${total} endpoints\n`);
  
  if (successful === total) {
    console.log('✅ ALL ENDPOINTS ARE WORKING CORRECTLY');
  } else {
    console.log('⚠️ SOME ENDPOINTS ARE FAILING');
    console.log('Failed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.endpoint}: ${r.status || r.error}`);
    });
  }
}

// Run the tests
testAllEndpoints().catch(error => {
  console.error('Error running tests:', error);
}); 