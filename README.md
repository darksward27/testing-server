# Realistic Server Load Testing Suite

This project provides a realistic Node.js server with multiple API endpoints and comprehensive load testing tools to evaluate how much traffic your machine can handle.

## Project Structure

- `server/index.js` - A realistic Express.js server with various endpoints that simulate real-world scenarios:
  - Authentication with JWT
  - Database operations (simulated)
  - File uploads
  - External API calls
  - Complex business logic
  - CPU and memory-intensive operations
- `load-test.js` - Script to test different server endpoints with varying levels of load
- `stress-test.js` - Advanced script to find the maximum capacity of concurrent users your server can handle

## Features

- **Authentication**: JWT-based token authentication
- **Caching**: In-memory data caching
- **File Operations**: Upload and process files
- **API Integration**: Simulated external API calls
- **Database Interactions**: Simulated MongoDB operations
- **Business Logic**: Order processing and checkout flow
- **Security**: Helmet protection and rate limiting
- **Performance**: Compression middleware
- **Monitoring**: Request logging with Morgan

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Server Endpoints

The server provides several realistic endpoints:

### Public Endpoints

- `GET /health` - Basic health check
- `POST /api/login` - User authentication
- `GET /api/products` - List all products (cached)
- `GET /api/products/:id` - Get a single product
- `GET /api/weather/:city` - Simulated weather API call

### Protected Endpoints (Require Authentication)

- `GET /api/profile` - Get authenticated user profile
- `POST /api/upload` - File upload endpoint
- `POST /api/checkout` - Process an order checkout

### Performance Testing Endpoints

- `GET /api/db-intensive` - Simulated database operations
- `GET /api/cpu-intensive` - CPU-intensive operations
- `GET /api/memory-intensive` - Memory-intensive operations

## Running Load Tests

While the server is running in one terminal, open another terminal and run:

```bash
npm test
```

This will test all endpoints with different connection levels and output the results, including:
- Request throughput (req/sec)
- Latency (avg, min, max, p95)
- Error rates
- Status code distribution

Results will be saved to the `results` directory as JSON files for later analysis.

## Running Stress Tests

To determine the maximum number of concurrent users your server can handle:

```bash
npm run stress
```

The stress test will:
1. Test each endpoint separately with progressively increasing load
2. Identify degradation points for each endpoint
3. Determine the overall system bottleneck
4. Provide optimization recommendations based on the results
5. Save detailed reports in the `results` directory

## Understanding Test Results

The test results include several key metrics:

- **Throughput** - Requests per second the server can handle
- **Latency** - Response time metrics (avg, p95, min, max)
- **Error Rate** - Percentage of requests that failed
- **Connections** - Number of concurrent connections
- **Degradation Point** - Where performance significantly declines
- **Optimal Connection Level** - Best balance of throughput vs latency

## Performance Optimization

Based on test results, you might consider:

1. **CPU-bound bottlenecks**: 
   - Add more CPU cores
   - Optimize algorithms
   - Use worker threads for CPU-intensive tasks

2. **Memory-bound bottlenecks**:
   - Increase available memory
   - Improve garbage collection
   - Reduce memory footprint

3. **I/O-bound bottlenecks**:
   - Implement caching
   - Use connection pooling
   - Optimize database queries

4. **Network-bound bottlenecks**:
   - Compress responses
   - Reduce payload sizes
   - Use HTTP/2 or HTTP/3

5. **Scaling strategies**:
   - Horizontal scaling with load balancing
   - Vertical scaling for specific bottlenecks
   - Microservices architecture

## Customizing Tests

You can modify the test parameters:

- In `load-test.js`: Adjust the test configuration for each endpoint
- In `stress-test.js`: Modify connection levels and thresholds for degradation detection

## Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret for JWT token signing (default: development key)
- `MONGO_URI` - MongoDB connection string (default: localhost)
- `WEATHER_API_KEY` - API key for real weather API integration (optional) 