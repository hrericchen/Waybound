# Release Workflow — iOS + Android

Two tracks, one repo (`master`). EAS Update handles instant JS releases; EAS Build +
Submit handles native releases to the App Store and Play Console.

## Track 1 — JS-only change (instant, no store review)

```bash
npx eas update --channel production
```

- Ships to every iOS + Android user on the production channel **in minutes**.
- Covers UI, features, bug fixes, API wiring — anything that isn't native code.
- With the GitHub Actions workflow in this repo, **pushing to `master` does this
  automatically** (`.github/workflows/update.yml`).

## Track 2 — Native change (icon, new native SDK, native config)

```bash
npx eas build --platform all --profile production   # creates .aab + .ipa
npx eas submit --platform all                        # uploads to both stores
```

- App Store review (~24–48h) and Play review apply.
- With the GitHub Actions workflow, **pushing a `v*` tag does the build automatically**
  (`.github/workflows/release.yml`); submission is a manual step until store
  credentials are configured.

## One-time setup

1. **EAS Update is now enabled** (`expo-updates` installed, `updates.url` +
   `runtimeVersion.appVersion` in `app.json`, `channel` in `eas.json`). The next
   native rebuild produces binaries that can receive OTA updates.
2. **Expo token for CI:** https://expo.dev/settings/access-tokens → create a token →
   add as GitHub secret `EXPO_TOKEN`. Add `EXPO_PUBLIC_API_URL` and
   `EXPO_PUBLIC_OAUTH_REDIRECT_URL` as **EAS project environment variables**
   (EAS dashboard → Environment variables) so both local and CI builds inline them.
3. **iOS signing:** `npx eas credentials` → iOS → Apple distribution certificate +
   provisioning profile (needs your Apple Developer account).
4. **Stores:** App Store Connect app record + Play Console app; then optionally
   `npx eas submit:configure` to automate submissions.

## Rules to remember

- EAS Update **cannot change native code** — native changes always need Track 2.
- **Runtime version**: `app.json` uses a static `"runtimeVersion": "1.0.0"` (required —
  this project is the "bare workflow" because of its committed `android/` folder, so
  runtime-version policies aren't supported). **Bump this string whenever you ship a
  native release** (keep it equal to the app version so old binaries never receive
  incompatible OTA updates). For JS-only updates, leave it unchanged.
- Apple allows OTA updates for bug fixes/improvements; significant new features
  should go through a store review.
- The current installed binary does **not** have `expo-updates` yet (it was disabled
  in previous builds) — the first rebuild after this change is the one that enables it.

## Granting Pro / Mini (RevenueCat)

The app calls `Purchases.logIn(fbUser.uid)`, so **RevenueCat subscriber ID = Firebase UID**.

1. **RevenueCat dashboard** (easiest): revenuecat.com → **Customers** → search the
   user's Firebase UID → **Entitlements → Grant** → **"Waybound Pro"** or
   **"Waybound Mini"** → lifetime or a duration.
   - Entitlement identifiers are hardcoded in the app as `Waybound Pro` / `Waybound Mini`
     — create these in RevenueCat → Entitlements if they don't exist.
2. **Firestore gift flag** (the app's own system, no RevenueCat needed): Firebase
   console → Firestore → `users/{firebaseUID}` → set `grantedPro: true` (or
   `grantedMini: true`). Revoke by setting to `false` / deleting the field.
3. **Backend (RevenueCat API)**: `POST /api/admin/entitlements` with an admin Firebase
   ID token and body `{ uid, entitlement: "pro"|"mini", action: "grant"|"revoke",
   duration: "lifetime" }`. Requires `REVENUECAT_SECRET_API_KEY` set in Render.

## Environment summary

| Value | Where |
|---|---|
| `https://waybound-backend.onrender.com` | backend API (Render) |
| `https://waybound-backend.onrender.com/oauth2redirect` | Google OAuth redirect (also registered in Google Cloud Web client) |
| `EXPO_PUBLIC_API_URL` | `.env` locally + EAS project env vars |
| `EXPO_PUBLIC_OAUTH_REDIRECT_URL` | `.env` locally + EAS project env vars |
