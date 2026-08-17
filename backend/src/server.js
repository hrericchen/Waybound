require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { initializeApp: initFirebaseAdmin, getApps } = require('firebase-admin/app');
const { getAuth: getFirebaseAdminAuth } = require('firebase-admin/auth');
const { getFirestore: getFirestoreAdmin } = require('firebase-admin/firestore');

// Firebase Admin — used to verify the app's admin account via its ID token and
// to perform privileged moderation operations (hard account deletion, server-
// side suspension/warning writes) with the Admin SDK.
// ID-token verification only needs the project's public keys (no service
// account credentials required), and this project is the same one the app
// uses, so grants always target the real Firebase UIDs.
// Privileged operations (deleteUser, Firestore writes) additionally require a
// service account. Provide one via FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON
// string) or GOOGLE_APPLICATION_CREDENTIALS (path to the JSON file).
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'verba-ai-98eaf';
if (!getApps().length) {
  let credential;
  try {
    const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (svcJson) {
      credential = require('firebase-admin').credential.cert(JSON.parse(svcJson));
    } else if (svcPath && fs.existsSync(svcPath)) {
      credential = require('firebase-admin').credential.cert(require(svcPath));
    }
  } catch (e) {
    console.warn('[firebase-admin] Could not load service account; privileged moderation operations will be unavailable:', e.message);
  }
  initFirebaseAdmin(
    credential ? { credential, projectId: FIREBASE_PROJECT_ID } : { projectId: FIREBASE_PROJECT_ID }
  );
}

/** Firestore Admin (server-side). Null when no service account is configured. */
const firestoreAdmin = () => {
  try {
    return getFirestoreAdmin();
  } catch (e) {
    console.warn('[firebase-admin] Firestore admin unavailable:', e.message);
    return null;
  }
};

/** Delete every doc in a collection matching field == value (admin SDK). */
async function deleteWhere(collectionName, field, value) {
  const db = firestoreAdmin();
  if (!db) return;
  try {
    const snap = await db.collection(collectionName).where(field, '==', value).limit(500).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size === 500) await deleteWhere(collectionName, field, value); // keep draining
  } catch (e) {
    console.warn(`[admin] Firestore cleanup ${collectionName}.${field} failed:`, e.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust for your needs
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:19006', 'exp://localhost:19000'],
  credentials: true,
}));
app.use(express.json({ limit: '100mb' })); // Increased limit for image uploads (multiple images)

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

// ---------------------------------------------------------------------------
// Admin: RevenueCat entitlement grants (Pro / Mini)
// ---------------------------------------------------------------------------
// The caller must be the app's admin account (admin@waybound.app). We verify
// their Firebase ID token here so the RevenueCat SECRET key never leaves the
// server. The app logs the admin in via Firebase Auth and sends that token in
// the Authorization header.
const ENTITLEMENT_IDS = { pro: 'Waybound Pro', mini: 'Waybound Mini' };
// ISO 8601 duration (e.g. P7D, P30D, P1M, P1Y) or "lifetime".
const RC_DURATION_RE = /^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;

const requireAdminFirebase = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
    }
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@waybound.app').toLowerCase();
    if (!decoded.email || decoded.email.toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not an admin account' });
    }
    req.adminUid = decoded.uid;
    next();
  } catch (e) {
    console.error('[admin] Firebase token verification failed:', e.message);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

const rcHeaders = () => ({
  Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
  'Content-Type': 'application/json',
  'X-Platform': process.env.REVENUECAT_PLATFORM || 'ios',
  ...(process.env.REVENUECAT_SANDBOX === 'true' ? { 'X-Is-Sandbox': 'true' } : {}),
});

// Look up a customer's current RevenueCat entitlement status.
app.get('/api/admin/customers/:uid',
  requireAdminFirebase,
  async (req, res) => {
    try {
      if (!process.env.REVENUECAT_SECRET_API_KEY) {
        return res.status(500).json({ error: 'Service unavailable', message: 'RevenueCat is not configured on the server' });
      }
      const uid = req.params.uid;
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
        { headers: rcHeaders() }
      );
      if (response.status === 404) {
        return res.json({ found: false, uid });
      }
      if (!response.ok) {
        console.error('[admin] RevenueCat customer lookup failed:', response.status);
        return res.status(response.status).json({ error: 'RevenueCat request failed' });
      }
      const data = await response.json();
      const subscriber = data.subscriber || {};
      const now = Date.now();
      const activeEntitlements = Object.entries(subscriber.entitlements || {})
        .filter(([, e]) => !e.expires_date || new Date(e.expires_date).getTime() > now)
        .map(([id]) => id);
      res.json({
        found: true,
        uid,
        firstSeen: subscriber.first_seen || null,
        lastSeen: subscriber.last_seen || null,
        activeEntitlements,
      });
    } catch (e) {
      console.error('[admin] RevenueCat customer lookup error:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Grant or revoke a Pro / Mini entitlement for a user.
app.post('/api/admin/entitlements',
  requireAdminFirebase,
  validateInput([
    body('uid').isLength({ min: 1, max: 128 }),
    body('entitlement').isIn(['pro', 'mini']),
    body('action').isIn(['grant', 'revoke']),
    body('duration').optional({ values: 'falsy' }).isString().custom((v) => v === 'lifetime' || RC_DURATION_RE.test(v)),
  ]),
  sanitizeInput,
  async (req, res) => {
    try {
      if (!process.env.REVENUECAT_SECRET_API_KEY) {
        return res.status(500).json({ error: 'Service unavailable', message: 'RevenueCat is not configured on the server' });
      }
      const { uid, entitlement, action, duration } = req.body;
      const entitlementId = ENTITLEMENT_IDS[entitlement];
      const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}/entitlements/${encodeURIComponent(entitlementId)}/${action}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: rcHeaders(),
        body: action === 'grant' ? JSON.stringify({ duration: duration || 'lifetime' }) : undefined,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('[admin] RevenueCat entitlement action failed:', response.status, JSON.stringify(data).slice(0, 300));
        return res.status(response.status).json({
          error: 'RevenueCat request failed',
          message: data?.error?.message || data?.message || 'RevenueCat rejected the request',
        });
      }

      const label = `${entitlementId} ${action === 'grant' ? 'granted' : 'revoked'} for ${uid}`;
      console.log(`[admin] ${label}`);
      res.json({ ok: true, action, entitlement, uid, message: label });
    } catch (e) {
      console.error('[admin] RevenueCat entitlement action error:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// ---------------------------------------------------------------------------
// Moderation: server-side warnings, suspensions, and hard account deletion.
// All routes are protected by requireAdminFirebase (the app's admin account).
// These bypass client-side Firestore rules via the Admin SDK, so a reported
// user can never clear their own suspension/deletion flags.
// ---------------------------------------------------------------------------

// Send a moderation warning to a user (notification + permanent warning record).
app.post('/api/admin/moderation/warn',
  requireAdminFirebase,
  validateInput([
    body('uid').isLength({ min: 1, max: 128 }),
    body('reason').isLength({ min: 1, max: 200 }),
    body('note').optional({ values: 'falsy' }).isLength({ max: 500 }),
  ]),
  async (req, res) => {
    const db = firestoreAdmin();
    if (!db) {
      return res.status(503).json({ error: 'Service unavailable', message: 'Firebase Admin is not configured on the server (missing service account).' });
    }
    const { uid, reason, note } = req.body;
    try {
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      const existing = snap.exists ? snap.data() : {};
      const warnings = existing.moderation?.warnings || [];
      warnings.push({ reason, note: note || '', createdAt: Date.now() });
      await userRef.set(
        {
          moderation: { ...(existing.moderation || {}), warnings, warningCount: warnings.length },
          lastModeratedAt: Date.now(),
        },
        { merge: true }
      );
      await db.collection('notifications').add({
        userId: uid,
        type: 'warning',
        fromUserId: 'waybound',
        fromUserName: 'Waybound Team',
        message: note
          ? `has issued a warning on your profile (${reason}): ${note}`
          : `has issued a warning on your profile (${reason}). Please review our community guidelines.`,
        createdAt: Date.now(),
        read: false,
      });
      console.log(`[moderation] ${req.adminUid} warned ${uid}: ${reason}`);
      res.json({ ok: true, warningCount: warnings.length });
    } catch (e) {
      console.error('[moderation] warn failed:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Suspend a user for N days (blocks their access until the timestamp).
app.post('/api/admin/moderation/suspend',
  requireAdminFirebase,
  validateInput([
    body('uid').isLength({ min: 1, max: 128 }),
    body('days').isInt({ min: 1, max: 365 }),
    body('reason').isLength({ min: 1, max: 200 }),
    body('note').optional({ values: 'falsy' }).isLength({ max: 500 }),
  ]),
  async (req, res) => {
    const db = firestoreAdmin();
    if (!db) {
      return res.status(503).json({ error: 'Service unavailable', message: 'Firebase Admin is not configured on the server (missing service account).' });
    }
    const { uid, days, reason, note } = req.body;
    try {
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      await db.collection('users').doc(uid).set(
        { suspendedUntil: until, suspendedReason: reason, suspendedAt: Date.now() },
        { merge: true }
      );
      await db.collection('notifications').add({
        userId: uid,
        type: 'suspension',
        fromUserId: 'waybound',
        fromUserName: 'Waybound Team',
        message: `has suspended your account for ${days} day${days > 1 ? 's' : ''} (${reason}).${note ? ` ${note}` : ''}`,
        createdAt: Date.now(),
        read: false,
      });
      console.log(`[moderation] ${req.adminUid} suspended ${uid} for ${days}d`);
      res.json({ ok: true, suspendedUntil: until });
    } catch (e) {
      console.error('[moderation] suspend failed:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Lift an active suspension early.
app.post('/api/admin/moderation/unsuspend',
  requireAdminFirebase,
  validateInput([body('uid').isLength({ min: 1, max: 128 })]),
  async (req, res) => {
    const db = firestoreAdmin();
    if (!db) {
      return res.status(503).json({ error: 'Service unavailable', message: 'Firebase Admin is not configured on the server (missing service account).' });
    }
    const { uid } = req.body;
    try {
      await db.collection('users').doc(uid).set(
        { suspendedUntil: 0, suspendedReason: '' },
        { merge: true }
      );
      res.json({ ok: true });
    } catch (e) {
      console.error('[moderation] unsuspend failed:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Hard-delete a user's account server-side: removes the Firebase Auth account
// (they can never sign in again) and wipes all their Firestore content. The
// account is fully gone — no one can see it anymore.
app.post('/api/admin/moderation/delete',
  requireAdminFirebase,
  validateInput([body('uid').isLength({ min: 1, max: 128 })]),
  async (req, res) => {
    const db = firestoreAdmin();
    if (!db) {
      return res.status(503).json({ error: 'Service unavailable', message: 'Firebase Admin is not configured on the server (missing service account).' });
    }
    const { uid } = req.body;
    try {
      // 1) Permanently delete the Firebase Auth account (blocks all sign-ins).
      try {
        await getFirebaseAdminAuth().deleteUser(uid);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }
      // 2) Wipe every piece of the user's content.
      await deleteWhere('itineraries', 'authorId', uid);
      await deleteWhere('follows', 'followerId', uid);
      await deleteWhere('follows', 'targetUserId', uid);
      await deleteWhere('notifications', 'userId', uid);
      await deleteWhere('notifications', 'fromUserId', uid);
      await deleteWhere('reports', 'reporterId', uid);
      await deleteWhere('reports', 'targetUserId', uid);
      // 3) Remove the user document itself.
      try {
        await db.collection('users').doc(uid).delete();
      } catch (e) {
        console.warn('[moderation] Failed to delete user doc:', e.message);
      }
      console.log(`[moderation] ${req.adminUid} permanently deleted ${uid}`);
      res.json({ ok: true, message: 'Account permanently deleted' });
    } catch (e) {
      console.error('[moderation] delete failed:', e.message);
      res.status(500).json({ error: 'Service unavailable' });
    }
  }
);

// Account status check: the app calls this with the user's Firebase ID token
// at sign-in and whenever the app comes to the foreground, so suspended or
// deleted accounts are enforced server-side.
app.get('/api/auth/status',
  async (req, res) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
      }
      const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
      const uid = decoded.uid;

      const db = firestoreAdmin();
      let suspendedUntil = 0;
      let deleted = false;
      let exists = null; // null = server can't determine (no service account)
      if (db) {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists) {
          exists = true;
          const data = snap.data();
          suspendedUntil = data.suspendedUntil || 0;
          deleted = !!data.deleted;
        } else {
          exists = false;
        }
      }
      res.json({
        uid,
        exists,
        suspended: !!suspendedUntil && suspendedUntil > Date.now(),
        suspendedUntil,
        deleted,
      });
    } catch (e) {
      console.error('[auth] status check failed:', e.message);
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  }
);

// Image upload endpoint for forum posts (base64 upload)
app.post('/api/upload',
  async (req, res) => {
    try {
      const { image, fileName } = req.body;
      
      if (!image || !fileName) {
        return res.status(400).json({ error: 'Missing image data or file name' });
      }
      
      // Extract base64 data (remove data:image/...;base64, prefix if present)
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Generate unique filename
      const ext = path.extname(fileName) || '.jpg';
      const uniqueName = `forum_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);
      
      fs.writeFileSync(filePath, buffer);
      
      const url = `/uploads/${uniqueName}`;
      res.json({ url, fileName: uniqueName });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Google OAuth redirect bounce. The Web OAuth client in Google Cloud is
// configured to send the user to https://<backend>/oauth2redirect after they
// consent (HTTPS is required — Google rejects custom schemes). We forward the
// code/state into the app via the custom scheme, which the app's intent filter
// handles. Must be registered before the 404 catch-all below.
app.get('/oauth2redirect', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(302, `com.waybound.travel:/oauthredirect${qs ? `?${qs}` : ''}`);
});

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