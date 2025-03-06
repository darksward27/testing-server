/**
 * Test definitions for load testing
 */

const axios = require('axios');
const config = require('./config');

// Optional authentication token for authenticated endpoints
let authToken = null;

// Test suite for different endpoints
const tests = [
  {
    name: 'Health Check',
    path: '/health',
    method: 'GET',
    ...config.defaultConfig,
    // Health checks can handle more concurrent users
    connections: 1000,
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
    ...config.defaultConfig,
    // Store auth token from response for later tests
    setupFn: async (client) => {
      try {
        // Do a manual request to get the auth token
        const response = await axios.post(`${config.defaultConfig.url}/api/login`, {
          username: 'user1', 
          password: 'password123'
        });
        authToken = response.data.token;
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
    ...config.defaultConfig,
    // Cached data can handle more concurrent users
    connections: 150,
  },
  {
    name: 'Get Single Product',
    path: '/api/products/1',
    method: 'GET',
    ...config.defaultConfig,
  },
  {
    name: 'Weather API (External API Call)',
    path: '/api/weather/London',
    method: 'GET',
    ...config.defaultConfig,
    // External API calls might need more timeout
    timeout: 10,
  },
  {
    name: 'Database Intensive Queries',
    path: '/api/db-intensive?queries=20',
    method: 'GET',
    ...config.defaultConfig,
    connections: 50, // Lower connections for DB intensive operations
  },
  {
    name: 'CPU Intensive (Medium Workload)',
    path: '/api/cpu-intensive?workload=200',
    method: 'GET',
    ...config.defaultConfig,
    // Lower connections for CPU-intensive tasks
    connections: 50,
  },
  {
    name: 'Memory Intensive (Small)',
    path: '/api/memory-intensive?size=1',
    method: 'GET',
    ...config.defaultConfig,
    // Fewer connections for memory-intensive tasks
    connections: 50,
  },
  {
    name: 'Memory Intensive (Large)',
    path: '/api/memory-intensive?size=10',
    method: 'GET',
    ...config.defaultConfig,
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
    ...config.defaultConfig,
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
    ...config.defaultConfig,
    // Complex logic needs fewer connections
    connections: 30,
    // Skip if no auth token is available
    skipIf: () => !authToken,
  }
];

// Expose auth token and tests
module.exports = {
  tests,
  getAuthToken: () => authToken,
  setAuthToken: (token) => { authToken = token; }
}; 