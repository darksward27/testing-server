const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const axios = require('axios');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Config
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-dev-only';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loadtest';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'demo-key';

// Set up file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(compression());
app.use(helmet());
app.use('/api', apiLimiter);

// MongoDB models
const connectDB = async () => {
  try {
    // Using a mock function for testing so we don't need an actual MongoDB server
    console.log('Connecting to MongoDB...');
    if (process.env.NODE_ENV !== 'production') {
      // Simulating database connection instead of actual connection
      // for testing purposes
      return true;
    } else {
      await mongoose.connect(MONGO_URI);
      console.log('MongoDB connected');
      return true;
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't crash the app, but log the error
    return false;
  }
};

// Simulate database models
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  stock: Number,
  createdAt: { type: Date, default: Date.now }
});

// Mock models for when no actual DB is present
const mockUsers = [
  { id: 1, username: 'user1', email: 'user1@example.com', password: 'hashed_password1' },
  { id: 2, username: 'user2', email: 'user2@example.com', password: 'hashed_password2' },
];

const mockProducts = [
  { id: 1, name: 'Product 1', price: 99.99, description: 'Description 1', stock: 100 },
  { id: 2, name: 'Product 2', price: 149.99, description: 'Description 2', stock: 50 },
  { id: 3, name: 'Product 3', price: 199.99, description: 'Description 3', stock: 75 },
];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Cache simulation
const cache = new Map();

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Authentication routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  // Simulate DB lookup and password verification
  const user = mockUsers.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Simulate CPU-intensive password hashing
  const hash = crypto.pbkdf2Sync(password, 'salt', 1000, 64, 'sha512').toString('hex');
  
  // Generate JWT token
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  
  res.json({ token });
});

// Authenticated user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  const user = mockUsers.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Don't return the password
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// Products routes
app.get('/api/products', (req, res) => {
  const cacheKey = 'all_products';
  
  // Check cache first
  if (cache.has(cacheKey)) {
    console.log('Cache hit for products');
    return res.json(cache.get(cacheKey));
  }
  
  // Simulate slight delay for DB operation
  setTimeout(() => {
    // Store in cache for 5 minutes
    cache.set(cacheKey, mockProducts);
    setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);
    
    res.json(mockProducts);
  }, 50);
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const product = mockProducts.find(p => p.id === id);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(product);
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Simulate file processing
  const start = Date.now();
  while (Date.now() - start < 100) {
    // CPU-intensive operation for file processing
    crypto.randomBytes(100);
  }
  
  res.json({ 
    success: true, 
    filename: req.file.filename,
    size: req.file.size
  });
});

// External API call simulation
app.get('/api/weather/:city', async (req, res) => {
  const city = req.params.city;
  
  try {
    // Simulate external API call with random latency
    const delay = Math.floor(Math.random() * 300) + 100; // Between 100-400ms
    
    // Either make a real API call or simulate one
    if (WEATHER_API_KEY !== 'demo-key') {
      // Real API call (if key provided)
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}`);
      return res.json(response.data);
    } else {
      // Simulated API response
      setTimeout(() => {
        res.json({
          city,
          temperature: Math.floor(Math.random() * 35) + 5, // 5-40 degrees
          humidity: Math.floor(Math.random() * 100),
          wind: Math.floor(Math.random() * 30),
          condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)]
        });
      }, delay);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Complex business logic endpoint (simulating an e-commerce checkout)
app.post('/api/checkout', authenticateToken, (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  
  if (!items || !items.length || !shippingAddress || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required checkout information' });
  }
  
  // Validate items are in stock
  const outOfStockItems = [];
  let totalPrice = 0;
  
  // Simulate complex business logic
  items.forEach(item => {
    const product = mockProducts.find(p => p.id === item.productId);
    if (!product) {
      outOfStockItems.push(item.productId);
    } else if (product.stock < item.quantity) {
      outOfStockItems.push(item.productId);
    } else {
      totalPrice += product.price * item.quantity;
    }
  });
  
  if (outOfStockItems.length) {
    return res.status(400).json({ 
      error: 'Some items are out of stock',
      outOfStockItems
    });
  }
  
  // Simulate payment processing
  const start = Date.now();
  while (Date.now() - start < 200) {
    // CPU-intensive operation simulating payment processing
    crypto.randomBytes(500);
  }
  
  // Generate order ID
  const orderId = crypto.randomBytes(8).toString('hex');
  
  res.json({
    success: true,
    orderId,
    totalPrice,
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
});

// Database stress test endpoint
app.get('/api/db-intensive', (req, res) => {
  const queries = parseInt(req.query.queries) || 10;
  const results = [];
  
  // Simulate multiple DB queries
  for (let i = 0; i < queries; i++) {
    // Simulate each query taking some time
    const start = Date.now();
    while (Date.now() - start < 20) {
      // CPU work simulating DB query processing
      Math.random() * Math.random();
    }
    
    // Add results
    results.push({
      id: i,
      name: `Result ${i}`,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({ results });
});

// CPU-intensive endpoint with adjustable workload
app.get('/api/cpu-intensive', (req, res) => {
  const workload = parseInt(req.query.workload) || 100;
  
  const start = Date.now();
  // Simulate CPU work for requested milliseconds
  while (Date.now() - start < workload) {
    // CPU-intensive operation
    crypto.randomBytes(10);
  }
  
  res.json({ 
    message: 'CPU intensive task completed',
    duration: Date.now() - start,
    requestedWorkload: workload
  });
});

// Memory-intensive endpoint with adjustable size
app.get('/api/memory-intensive', (req, res) => {
  const size = parseInt(req.query.size) || 1;
  
  // Create a large array (size in MB)
  const mb = 1024 * 1024;
  const largeArray = Buffer.alloc(size * mb);
  
  res.json({ 
    message: 'Memory intensive task completed',
    size: `${size} MB`,
    actualBytes: largeArray.length
  });
  
  // Allow garbage collection to clean up
});

// Connect to database (or simulate connection)
connectDB().then(() => {
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test endpoints:`);
    console.log(`- GET /health             (Basic health check)`);
    console.log(`- POST /api/login         (Authentication)`);
    console.log(`- GET /api/profile        (Authenticated route)`);
    console.log(`- GET /api/products       (Cached data)`);
    console.log(`- GET /api/products/:id   (Single resource)`);
    console.log(`- POST /api/upload        (File upload)`);
    console.log(`- GET /api/weather/:city  (External API call)`);
    console.log(`- POST /api/checkout      (Complex business logic)`);
    console.log(`- GET /api/db-intensive   (Database operations)`);
    console.log(`- GET /api/cpu-intensive  (CPU-bound task)`);
    console.log(`- GET /api/memory-intensive (Memory-intensive task)`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app; // Export for testing purposes 