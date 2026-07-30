require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust for your needs
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19006', 'exp://localhost:19000'],
  credentials: true,
}));
app.use(express.json({ limit: '10kb' })); // Limit payload size

// In-memory storage for rate limiting (use Redis in production)
const loginAttempts = new Map();
const ipRequests = new Map();

// Rate limiting middleware
const createRateLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP + user agent for more granular limiting
      return `${req.ip}-${req.get('user-agent') || 'unknown'}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
      });
    }
  });
};

// Brute-force protection for login
const checkLoginAttempts = (req, res, next) => {
  const ip = req.ip;
  const identifier = req.body.email?.toLowerCase() || ip;
  const key = `${ip}-${identifier}`;
  
  const attempts = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  
  // Check if locked out
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: 'Account temporarily locked',
      message: 'Too many failed attempts. Please try again later.',
      retryAfter: remainingTime
    });
  }
  
  // Clear lockout if expired
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    loginAttempts.delete(key);
  }
  
  req.loginAttempts = attempts;
  req.loginAttemptKey = key;
  next();
};

// Input validation middleware
const validateInput = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    // Generic error message - don't leak validation details
    res.status(400).json({
      error: 'Invalid input',
      message: 'Please check your input and try again.'
    });
  };
};

// Sanitize input to prevent XSS
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  next();
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint for exchange rates
app.get('/api/exchange-rates',
  createRateLimiter(),
  async (req, res) => {
    try {
      const apiKey = process.env.EXCHANGERATE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Service unavailable' });
      }
      
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      );
      
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch exchange rates' });
      }
      
      const data = await response.json();
      
      if (data.result === 'error') {
        return res.status(500).json({ error: 'Service error' });
      }
      
      res.json({
        rates: {
          USD: 1,
          EUR: data.conversion_rates.EUR || 0.92,
          GBP: data.conversion_rates.GBP || 0.79,
          JPY: data.conversion_rates.JPY || 149.50,
          CAD: data.conversion_rates.CAD || 1.36,
          AUD: data.conversion_rates.AUD || 1.52,
        },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Exchange rates error:', error);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Login endpoint with brute-force protection
app.post('/api/auth/login',
  createRateLimiter(),
  checkLoginAttempts,
  validateInput([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }),
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Increment failed attempts
      req.loginAttempts.count += 1;
      
      // Check if should lock out (4 failed attempts)
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 4;
      if (req.loginAttempts.count >= maxAttempts) {
        const lockoutDuration = parseInt(process.env.LOCKOUT_DURATION_MS) || 30 * 60 * 1000;
        req.loginAttempts.lockedUntil = Date.now() + lockoutDuration;
        loginAttempts.set(req.loginAttemptKey, req.loginAttempts);
        
        return res.status(429).json({
          error: 'Account temporarily locked',
          message: 'Too many failed attempts. Please try again later.',
          retryAfter: Math.ceil(lockoutDuration / 1000)
        });
      }
      
      // Store attempts
      loginAttempts.set(req.loginAttemptKey, req.loginAttempts);
      
      // Verify against stored hash (in production, check database)
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
      
      if (email.toLowerCase() === adminEmail?.toLowerCase() && adminPasswordHash) {
        const isValid = await bcrypt.compare(password, adminPasswordHash);
        if (isValid) {
          // Clear attempts on successful login
          loginAttempts.delete(req.loginAttemptKey);
          
          const token = jwt.sign(
            { email, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
          );
          
          return res.json({
            token,
            user: {
              id: 'admin-001',
              email: adminEmail,
              name: 'Admin',
              isAdmin: true
            }
          });
        }
      }
      
      // Generic error message - don't reveal if email exists
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
        attemptsRemaining: maxAttempts - req.loginAttempts.count
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Signup endpoint
app.post('/api/auth/signup',
  createRateLimiter(),
  validateInput([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }),
    body('name').optional().isLength({ min: 1, max: 100 }),
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      // Hash password before storing (in production, store in database)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // In production: Save to database with hashed password
      // await db.users.create({ email, password: hashedPassword, name });
      
      const token = jwt.sign(
        { email, name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '24h' }
      );
      
      res.status(201).json({
        token,
        user: {
          id: `user-${Date.now()}`,
          email,
          name: name || email.split('@')[0],
          isAdmin: false
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Google Maps Geocoding proxy
app.get('/api/geocode',
  createRateLimiter(),
  validateInput([
    body('address').isLength({ min: 1, max: 200 }),
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Service unavailable' });
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK') {
        return res.status(500).json({ error: 'Geocoding failed' });
      }
      
      res.json({
        results: data.results,
        status: data.status
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Service unavailable' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});