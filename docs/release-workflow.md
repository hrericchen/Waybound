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
- Apple allows OTA updates for bug fixes/improvements; significant new features
  should go through a store review.
- The current installed binary does **not** have `expo-updates` yet (it was disabled
  in previous builds) — the first rebuild after this change is the one that enables it.

## Environment summary

| Value | Where |
|---|---|
| `https://waybound-backend.onrender.com` | backend API (Render) |
| `https://waybound-backend.onrender.com/oauth2redirect` | Google OAuth redirect (also registered in Google Cloud Web client) |
| `EXPO_PUBLIC_API_URL` | `.env` locally + EAS project env vars |
| `EXPO_PUBLIC_OAUTH_REDIRECT_URL` | `.env` locally + EAS project env vars |
