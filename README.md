# Node.js Load Testing Server

This project provides a Node.js server with built-in load testing capabilities. The server includes various API endpoints that simulate different types of workloads and response patterns commonly found in real-world applications.

## Server Features

- **Basic API endpoints** (health check, products, etc.)
- **Authentication** with JWT tokens
- **Database operations** (simulated)
- **CPU-intensive operations**
- **Memory-intensive operations**
- **External API calls** (simulated)
- **File upload capabilities**
- **Complex business logic** (checkout process)

## Load Testing Tools

The project includes a simplified load testing script that focuses on three key features:

1. **Sending Requests** - Tests all endpoints with configurable concurrency
2. **Verifying Responses** - Validates all responses automatically
3. **Controlling Load** - Allows adjusting users per second via command line

## Performance Findings

Based on our load testing, we've found the following performance characteristics:

| Endpoint | Throughput | Avg. Latency | Max Connections | Error Rate |
|----------|------------|--------------|----------------|------------|
| Health Check | ~1,165,000 req/sec | 7.5ms | 10 | 0% |
| Products List | ~476,000 req/sec | 21.19ms | 20 | 0% |
| Single Product | Limited | High | 30 | High |
| Authentication | Moderate | Varies | 50 | Low |
| User Profile | Moderate | Varies | 50 | Low |

### Key Observations

1. The server performs very well with simple endpoints like health checks
2. Cached data endpoints (like Products List) also perform well
3. Endpoints requiring complex logic or database operations show significantly lower throughput
4. High concurrency levels can trigger timeouts, especially for resource-intensive endpoints
5. The server may struggle with handling too many concurrent memory or CPU-intensive operations

## Running the Tests

### Prerequisites

- Node.js 14+ installed
- NPM or Yarn package manager

### Installation

```bash
# Install dependencies
npm install
```

### Starting the Server

```bash
# Start the server
npm start
```

### Running Tests

```bash
# Run basic health check to verify server is running
npm run check

# Run load test against all endpoints with default concurrency
npm test

# Run load test with custom number of concurrent users (500)
npm run test:connections
```

To customize the number of concurrent users:

```bash
# Run with any number of connections (users per second)
node simple-verify-load-test.js --connections=1000
```

## Optimizing Server Performance

Based on our testing, here are recommendations for optimizing the server:

1. **Implement caching** for frequently accessed data
2. **Limit concurrent CPU-intensive operations**
3. **Set appropriate timeouts** for different types of operations
4. **Monitor memory usage** carefully, especially for memory-intensive operations
5. **Implement horizontal scaling** for high-traffic scenarios
6. **Use rate limiting judiciously** to prevent abuse while allowing legitimate traffic

## Troubleshooting Common Issues

- **Timeouts**: Reduce the number of concurrent connections or increase the server's timeout settings
- **Memory errors**: Limit memory-intensive operations and monitor server memory usage
- **High latency**: Check for blocking operations in the request handler and consider using async patterns
- **Rate limiting errors**: Adjust rate limiting settings or distribute requests over a longer time period

## License

ISC 