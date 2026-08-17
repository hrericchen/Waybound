# Deploy the Backend to Render (with Cloudflare + Google OAuth redirect)

This deploys the `backend/` Express server publicly so it can:
1. Serve the app's API (exchange rates, geocode, auth status, admin/moderation, uploads).
2. Host the **`/oauth2redirect`** bounce endpoint required for the browser-based
   Google sign-in fallback (Google only accepts HTTPS redirect URIs).

## 1. Push to GitHub

`backend/` is deployment-ready (has its own `.gitignore`, `render.yaml` blueprint,
and `"engines": { "node": ">=20.19.0" }`). Push the repo to GitHub — Render deploys
from it.

## 2. Create the Render service

**Option A — Blueprint (easiest):** Render dashboard → **New → Blueprint** → select
the repo. `backend/render.yaml` is auto-detected.

**Option B — Manual Web Service:**
- New → **Web Service** → connect the repo.
- **Root Directory**: `backend`
- Runtime: **Node**; Build: `npm install`; Start: `npm start`
- Add env vars (secrets — do not commit):

```
NODE_ENV=production
FIREBASE_PROJECT_ID=verba-ai-98eaf
JWT_SECRET=<your value>
ENCRYPTION_KEY=<32 chars>
FIREBASE_SERVICE_ACCOUNT_JSON=<raw service-account JSON, single line>
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD_HASH=<bcrypt hash>
REVENUECAT_SECRET_API_KEY=<value>
EXCHANGERATE_API_KEY=<value>
GOOGLE_API_KEY=<value>
GOOGLE_MAPS_API_KEY=<value>
```

Deploy. Render gives you `https://<service-name>.onrender.com` (auto-HTTPS, `PORT`
auto-injected).

**Verify:**
```bash
curl https://<service-name>.onrender.com/api/health      # {"status":"ok"}
curl -sI https://<service-name>.onrender.com/oauth2redirect   # 302 → com.waybound.travel:/oauthredirect
```

## 3. Cloudflare in front (recommended for speed)

Render is already served over Cloudflare's edge, but putting **your domain** on
Cloudflare gives you faster DNS, free SSL, and a branded URL (`api.yourdomain.com`).

1. Move your domain's DNS to Cloudflare (free plan is fine).
2. Render → your service → **Settings → Custom Domain** → add `api.yourdomain.com`.
   Render prints a CNAME target like `<service>.onrender.com`.
3. In Cloudflare DNS: **CNAME** `api` → `<service>.onrender.com`, **Proxied** (orange
   cloud) for CDN + SSL.

**Cache rule (important):** create a Cache Rule so the API is never cached:
```
URI path starts with /api/  or  URI path equals /oauth2redirect  →  Bypass cache
```
(Dynamic API responses and the OAuth bounce must always reach the origin. Cloudflare
does not cache these by default, but the rule makes it explicit.)

## 4. Register the OAuth redirect URI (Google Cloud Console)

Google Cloud Console → project `verba-ai-98eaf` → **APIs & Services → Credentials** →
**Web application** client `732997491914-eotvgdvv430gsu16i978clqg1577gicm.apps.googleusercontent.com`
→ **Authorized redirect URIs** → add (exact match, must be HTTPS with a real domain):
```
https://<service-name>.onrender.com/oauth2redirect
```
or, with the custom domain:
```
https://api.yourdomain.com/oauth2redirect
```

## 5. Point the app at the backend

In `.env` (set **before** running `eas build` — `EXPO_PUBLIC_*` vars are inlined at
build time):

```
EXPO_PUBLIC_API_URL=https://<service-name>.onrender.com
EXPO_PUBLIC_OAUTH_REDIRECT_URL=https://<service-name>.onrender.com/oauth2redirect
```

Rebuild (dev client / EAS). The browser-based Google fallback then uses:
`Google auth → your HTTPS endpoint → 302 → com.waybound.travel:/oauthredirect → app`.

## Known limitations

- **Render free tier sleeps after ~15 min idle** → first request after idle can take
  30–60s. Use a paid instance if sign-in must always be fast.
- **Uploaded forum images** live on an ephemeral disk — they reset on redeploy/restart.
  Move to object storage (e.g. Cloudinary/S3) before scaling.
- The final hop into the app still requires a browser that handles the
  `com.waybound.travel:` deep link (Chrome works; Bing on some devices does not).
