/**
 * Response validators for different API endpoints
 */

const validators = {
  // Health endpoint
  '/health': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.status === 'ok' && typeof data.uptime === 'number';
    } catch (e) {
      return false;
    }
  },
  
  // Login endpoint
  '/api/login': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.token && typeof data.token === 'string';
    } catch (e) {
      return false;
    }
  },
  
  // Products listing endpoint
  '/api/products': (response) => {
    try {
      const data = JSON.parse(response);
      return Array.isArray(data) && data.length > 0 && data[0].id && data[0].name;
    } catch (e) {
      return false;
    }
  },
  
  // Single product endpoint
  '/api/products/1': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.id === 1 && data.name && data.price;
    } catch (e) {
      return false;
    }
  },
  
  // Weather endpoint
  '/api/weather/London': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.city === 'London' && 
        typeof data.temperature === 'number' && 
        typeof data.humidity === 'number';
    } catch (e) {
      return false;
    }
  },
  
  // Database intensive endpoint
  '/api/db-intensive': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.results && Array.isArray(data.results);
    } catch (e) {
      return false;
    }
  },
  
  // CPU intensive endpoint
  '/api/cpu-intensive': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.message && data.duration && data.requestedWorkload;
    } catch (e) {
      return false;
    }
  },
  
  // Memory intensive endpoint
  '/api/memory-intensive': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.message && data.size && data.actualBytes;
    } catch (e) {
      return false;
    }
  },
  
  // User profile endpoint
  '/api/profile': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.id && data.username && !data.password; // Password should not be returned
    } catch (e) {
      return false;
    }
  },
  
  // Checkout endpoint
  '/api/checkout': (response) => {
    try {
      const data = JSON.parse(response);
      return data && data.success === true && data.orderId && data.totalPrice;
    } catch (e) {
      return false;
    }
  }
};

module.exports = validators; 