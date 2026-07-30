# Waybound Security Implementation Guide

## Overview
This document outlines the security measures implemented in the Waybound app to protect user data, prevent attacks, and ensure secure API key management.

## 🔐 Security Features Implemented

### 1. API Key Protection
**Problem**: API keys were hardcoded in frontend code, exposing them to anyone who inspects the app.

**Solution**:
- Moved all API keys to backend `.env` file (never committed to version control)
- Created secure backend proxy endpoints that make API calls server-side
- Frontend now calls backend endpoints instead of external APIs directly

**Files Changed**:
- `backend/.env.example` - Template for environment variables
- `backend/src/server.js` - Secure proxy endpoints
- `src/services/apiService.ts` - Frontend API client
- `src/services/exchangeRateService.ts` - Now uses secure proxy
- `src/constants/google.ts` - API key removed from frontend

**Protected Keys**:
- ExchangeRate API key
- Google Maps API key  
- Google API key

### 2. Authentication Security

#### Backend Authentication
- **JWT Tokens**: Secure token-based authentication with configurable expiry
- **Password Hashing**: bcrypt with salt rounds (10) for password storage
- **Brute-Force Protection**: 
  - Maximum 4 failed login attempts
  - 30-minute lockout after exceeding attempts
  - Tracks attempts by IP + email combination
  - Cannot be bypassed (enforced server-side)

#### Frontend Authentication
- **Input Validation**: All login/signup forms validated before submission
- **Password Strength**: Enforces minimum 8 characters with uppercase, lowercase, and numbers
- **XSS Prevention**: All inputs sanitized before processing
- **Generic Error Messages**: No information leakage about which field failed

**Files Changed**:
- `backend/src/server.js` - Login/signup endpoints with rate limiting
- `src/services/authService.ts` - Secure authentication flow
- `src/screens/SignInScreen.tsx` - Added validation and error handling
- `src/screens/SignUpScreen.tsx` - Added validation and error handling

### 3. Input Validation & Sanitization

**Validation Rules**:
- **Email**: RFC-compliant format, max 254 characters
- **Password**: Min 8 chars, requires uppercase, lowercase, number
- **Name**: Letters, spaces, hyphens, apostrophes only, max 100 chars
- **Address**: Max 200 characters

**XSS Prevention**:
- All user inputs sanitized to escape HTML entities
- Prevents script injection attacks
- Applied to all form inputs before processing

**Files Changed**:
- `src/utils/validation.ts` - Comprehensive validation utilities
- Applied to: SignInScreen, SignUpScreen, authService

### 4. Rate Limiting

**Global Rate Limiting**:
- 5 requests per 15-minute window per IP
- Applied to all API endpoints
- Prevents DoS attacks

**Login-Specific Rate Limiting**:
- 4 failed attempts → 30-minute lockout
- Tracks by IP + email combination
- Returns `retryAfter` timestamp
- Cannot be bypassed (server-enforced)

**Files Changed**:
- `backend/src/server.js` - Rate limiting middleware

### 5. Security Headers & Middleware

**Helmet.js**:
- Sets secure HTTP headers
- Protects against common vulnerabilities (XSS, sniffing, etc.)

**CORS**:
- Configured to only allow specific origins
- Prevents unauthorized cross-origin requests

**Payload Limits**:
- 10KB max request body size
- Prevents buffer overflow attacks

**Files Changed**:
- `backend/src/server.js` - Security middleware

### 6. Error Handling

**Generic Error Messages**:
- No stack traces exposed to client
- No internal details leaked
- User-friendly messages only

**Examples**:
- ❌ "Connection refused to database at 192.168.1.100:5432"
- ✅ "Service temporarily unavailable. Please try again later."

**Files Changed**:
- `src/utils/validation.ts` - Generic error message utility
- `backend/src/server.js` - Generic error responses

## 📁 File Structure

```
Waybound/
├── .env.example                    # Frontend environment template
├── .gitignore                      # Protects .env files
├── SECURITY.md                     # This file
├── backend/
│   ├── .env.example               # Backend environment template
│   ├── package.json               # Backend dependencies
│   └── src/
│       └── server.js              # Secure backend server
├── src/
│   ├── utils/
│   │   └── validation.ts          # Input validation & sanitization
│   ├── services/
│   │   ├── apiService.ts          # Secure API client
│   │   ├── authService.ts         # Updated with validation
│   │   └── exchangeRateService.ts # Uses secure proxy
│   └── screens/
│       ├── SignInScreen.tsx       # Added validation
│       └── SignUpScreen.tsx       # Added validation
```

## 🚀 Setup Instructions

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env`:
```env
PORT=3000
NODE_ENV=production

# API Keys (Get from respective providers)
EXCHANGERATE_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here

# Firebase (if using)
FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id

# Security
JWT_SECRET=generate_a_secure_random_string_min_32_chars
JWT_EXPIRY=24h
ENCRYPTION_KEY=your_32_character_encryption_key

# Admin (use bcrypt hash, not plaintext)
ADMIN_EMAIL=admin@waybound.app
ADMIN_PASSWORD_HASH=$2b$10$your_bcrypt_hash_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
MAX_LOGIN_ATTEMPTS=4
LOCKOUT_DURATION_MS=1800000
```

### 3. Generate Admin Password Hash

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123', 10));"
```

Copy the output hash to `ADMIN_PASSWORD_HASH` in `.env`.

### 4. Start Backend Server

```bash
# Development
cd backend
npm run dev

# Production
npm start
```

### 5. Update Frontend API URL

In production, update `src/services/apiService.ts`:
```typescript
const API_BASE_URL = 'https://your-actual-backend-domain.com/api';
```

Or use environment variable in `app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-backend.com/api"
    }
  }
}
```

## 🔑 Generating Secure Secrets

### JWT Secret
```bash
# Linux/Mac
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encryption Key
```bash
# Must be exactly 32 characters
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

### Bcrypt Password Hash
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword', 10));"
```

## 🛡️ Security Best Practices

### For Development
1. ✅ Use `.env` files for all secrets
2. ✅ Never commit `.env` to version control
3. ✅ Use strong, unique passwords for admin accounts
4. ✅ Rotate API keys regularly
5. ✅ Monitor rate limit logs for abuse

### For Production
1. ✅ Use HTTPS everywhere (SSL/TLS certificates)
2. ✅ Use environment variables from secure vault (AWS Secrets Manager, etc.)
3. ✅ Implement Redis for rate limiting (instead of in-memory Map)
4. ✅ Use a real database (PostgreSQL, MongoDB) instead of in-memory storage
5. ✅ Enable CORS only for your actual domains
6. ✅ Set up monitoring and alerting for suspicious activity
7. ✅ Regular security audits and penetration testing
8. ✅ Implement CSRF tokens for state-changing operations
9. ✅ Add request signing for sensitive operations
10. ✅ Use Web Application Firewall (WAF)

## 🚨 Critical Security Notes

### NEVER Do This:
- ❌ Commit `.env` files to Git
- ❌ Expose API keys in frontend code
- ❌ Store passwords in plaintext
- ❌ Disable rate limiting in production
- ❌ Use weak JWT secrets
- ❌ Trust client-side validation alone
- ❌ Expose stack traces to users

### ALWAYS Do This:
- ✅ Validate and sanitize all inputs
- ✅ Use HTTPS in production
- ✅ Hash passwords with bcrypt/argon2
- ✅ Implement rate limiting
- ✅ Use generic error messages
- ✅ Keep dependencies updated
- ✅ Monitor for suspicious activity

## 📊 Security Checklist

- [x] API keys moved to backend
- [x] Backend proxy endpoints created
- [x] Input validation implemented
- [x] XSS prevention (input sanitization)
- [x] Password strength requirements
- [x] Brute-force protection (4 attempts → 30min lockout)
- [x] Rate limiting (5 req/15min)
- [x] Generic error messages
- [x] JWT authentication
- [x] Password hashing (bcrypt)
- [x] Security headers (Helmet.js)
- [x] CORS configuration
- [x] .gitignore configured
- [ ] HTTPS enabled (production)
- [ ] Redis for rate limiting (production)
- [ ] Database for user storage (production)
- [ ] Monitoring & alerting (production)
- [ ] Security audit (production)

## 🔍 Testing Security

### Test Rate Limiting
```bash
# Should succeed 4 times, then fail
for i in {1..6}; do curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'; done
```

### Test Input Validation
```bash
# Should fail - invalid email
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"invalid","password":"short"}'

# Should fail - SQL injection attempt
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@test.com","password":" OR 1=1 --"}'
```

### Test XSS Prevention
```bash
# Should sanitize script tags
curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"Test1234","name":"<script>alert(1)</script>"}'
```

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Native Security](https://reactnative.dev/docs/security)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

## 🆘 Reporting Security Issues

If you discover a security vulnerability, please email: **security@waybound.app**

Do not open public GitHub issues for security vulnerabilities.

---

**Last Updated**: 2026-07-17
**Version**: 1.0.0