# Google Sign-In: "Continue with Google" opens a browser and never returns to the app

## Symptom

On an **EAS production build**, tapping **Continue with Google**:

1. Opens the device's default browser (e.g. Microsoft Bing on a Xiaomi/HyperOS device).
2. Shows a Google page with a **Continue** button.
3. Never redirects back to the app, so sign-in never finishes.

The error message never appears in the app because the app never receives a result — the flow dies in the browser.

## Status (updated 2026-08-17)

✅ **The certificate fingerprint is now registered correctly.** The freshly downloaded
`google-services.json` from Firebase (project `verba-ai-98eaf`, Android app
`com.waybound.travel`) contains **four** registered SHA-1 fingerprints:

| SHA-1 | OAuth client_id | Keystore |
|---|---|---|
| `5AE37189F2B4F879FE4690D176C08ABE40D5B34D` | `732997491914-0biluu62...` | **EAS-managed keystore** (signs every EAS build) |
| `CC226B237BECFEFFCEC84A7067848D2D2ED78513` | `732997491914-df3taqg9...` | older / unknown |
| `3DF2B6AD83451CCEA3AF0C62264396FFEC27ADA6` | `732997491914-h8ss0hjo7...` | unknown |
| `036FF89462C0EE7849AA4E94A45728C4C8F5A81C` | `732997491914-odq9ah2ih...` | local release keystore |

The `5AE37189...` entry matches the certificate of the installed EAS production build
(verified by pulling the APK and checking with apksigner), so **certificate validation is
no longer the blocker**. The repo copies of `google-services.json` (`./google-services.json`
and `android/app/google-services.json`) have both been updated to this fresh file.

## Why the browser still opens even with the fingerprint registered

The native Google Sign-In only stays fully in-app when the phone has a **Google account
added at the OS level** (Android Settings → Accounts). When there's no OS-level Google
account, Google Play Services falls back to a **web flow** — account chooser in the browser,
"Continue", then a callback to the app. On a China-ROM Xiaomi with **Bing as the default
browser** (and often no Chrome for Chrome Custom Tabs), that web flow frequently cannot
complete the return hop to the app. Other causes:

1. No Google account added on the device → forces the web flow (most likely).
2. Bing / the network cannot complete the OAuth callback (accounts.google.com reachability).
3. Google Chrome not installed → GMS cannot use Chrome Custom Tabs for the return.
4. Network flakiness to Google from China.

## What to do next (device-side)

1. On the phone: **Settings → Accounts / Passwords & accounts → Add account → Google** and
   sign in. Once an OS-level Google account exists, the native account picker appears and the
   whole sign-in completes in-app — no browser.
2. Install/ensure **Google Chrome** is present so Play Services can use Chrome Custom Tabs.
3. Re-test. If it still opens the browser, capture the failure:

```powershell
adb logcat -c
adb logcat -v time > signin.log     # then tap "Continue with Google" in the app for ~30s
# search signin.log for GoogleSignIn / GMS / ReactNativeJS errors
```

## No Google account on the device (browser flow)

The native Google Sign-In SDK cannot complete without either Play Services or an
OS-level Google account. The app now has a **browser-based fallback** so sign-in
still works without any OS-level account:

- **Primary:** native Google Sign-In (account picker). Works when the phone has a
  Google account added in Settings → Accounts.
- **Fallback:** if the native flow can't run (no Play Services / no OS account /
  cert mismatch), `SignInScreen` opens **Google's web OAuth** via
  `expo-auth-session` (already bundled). The user signs in in the browser and the
  app receives the result through the `com.waybound.travel` deep link.

Two requirements for the fallback to work:

1. **Chrome must be installed on the device.** Google's web flow returns to the
   app through Chrome Custom Tabs. Without Chrome, the default browser (e.g. Bing
   on Xiaomi/HyperOS) usually cannot hand back to the app — that is the "opens
   Bing and stays there" failure.
2. **One-time Google Cloud setup:** the OAuth redirect URI must be registered on
   the **Web** client so Google allows the redirect back:
   - https://console.cloud.google.com → project → APIs & Services → Credentials
   - Open the **Web** OAuth client `732997491914-eotvgdvv430gsu16i978clqg1577gicm.apps.googleusercontent.com`
   - **Authorized redirect URIs** → add:
     ```
     com.waybound.travel:/oauthredirect
     ```
   - Save and wait a few minutes for propagation.

Why the Web client? Firebase's `signInWithCredential` only accepts Google id
tokens whose audience (`aud`) is the project's **Web** client ID, so the browser
flow must use that client. The Android client IDs cannot be used here.

## Video on the Get Started (Splash) screen

The Splash screen plays a looping, muted background video from
`assets/video.mp4` (`expo-video`). The file is bundled with the app, so keep it
reasonably small (compress to a few MB / 720p landscape if possible — a 76 MB
video adds ~76 MB to the APK).

## Verify with the helper script

Run (from the project root), passing any APK or AAB that came from EAS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\signing_info.ps1 path\to\app.apk
```

It prints every keystore/APK fingerprint, the fingerprints registered in
`google-services.json`, and a **CHECK** section that flags any `[MISS]` fingerprint that is
not registered in Firebase. With the current file, the EAS keystore fingerprint should show
as `[OK]`.

## How to confirm the cert of an installed EAS build

```powershell
# 1. Pull the installed base APK (path shown in the output of `pm path`).
adb shell pm path com.waybound.travel
adb pull /data/app/<...>/base.apk ./installed.apk

# 2. Print its signing cert.
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs ./installed.apk
```

The `Signer #1 certificate SHA-1 digest` must be one of the hashes listed above.

## Notes

- **Do not** regenerate or delete the EAS keystore (`eas credentials` → Android → Keystore).
  A new keystore = a new fingerprint that would need to be registered again. Back it up:
  `eas credentials` → Android → Keystore → **Download**.
- If you ever add/remove fingerprints in Firebase, re-download `google-services.json` and
  replace **both** repo copies to keep them in sync.

