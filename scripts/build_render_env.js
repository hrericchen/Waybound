// scripts/build_render_env.js
// Prints a paste-ready KEY=VALUE block for the Render dashboard, sourced from
// the local .env. Secrets are only printed to your own terminal and never
// committed anywhere.
//
// Usage:  node scripts/build_render_env.js
// Then paste the output into Render -> your service -> Environment.
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found at ' + envPath);
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

// Simple keys that map 1:1 from the local .env into Render.
const order = [
  'JWT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD_HASH',
  'EXCHANGERATE_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'JWT_EXPIRY',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'MAX_LOGIN_ATTEMPTS',
  'LOCKOUT_DURATION_MS',
  'REVENUECAT_PLATFORM',
  'REVENUECAT_SANDBOX',
  'REVENUECAT_SECRET_API_KEY',
];

const missing = [];
for (const key of order) {
  if (env[key] !== undefined) {
    console.log(`${key}=${env[key]}`);
  } else {
    missing.push(key);
  }
}

// Values that must come from their dashboards (not in the local .env).
const external = {
  FIREBASE_SERVICE_ACCOUNT_JSON:
    'Firebase console -> Project settings -> Service accounts -> Generate new private key -> paste the whole JSON as the value.',
  REVENUECAT_SECRET_API_KEY:
    'RevenueCat dashboard -> Project settings -> API keys -> "Secret" key (NOT the public SDK key).',
};
for (const [key, how] of Object.entries(external)) {
  if (env[key] === undefined && !missing.includes(key)) {
    missing.push(key);
  }
}

if (missing.length) {
  console.log('\n# Not set locally - add these manually in Render:');
  for (const key of missing) {
    console.log(`# ${key}: ${external[key] || 'copy from your .env'}`);
  }
}

console.log('\n# Already provided by the blueprint (no action needed):');
console.log('# NODE_ENV=production');
console.log('# FIREBASE_PROJECT_ID=verba-ai-98eaf');
console.log('# Render sets PORT automatically.');
console.log('# ALLOWED_ORIGINS: only needed for the future web version (e.g. https://waybound.example.com).');
