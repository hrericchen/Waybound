# iOS Launch Checklist — Waybound

Android code/config is mostly shared; this is the iOS-specific prep. Estimated
effort: ~1–2 days of account/setup work + App Store review time.

## Phase 0 — Accounts (one-time, ~$99/yr)

- [ ] **Apple Developer Program** — https://developer.apple.com/programs/enroll/
- [ ] Sign into **App Store Connect** (same Apple ID) and accept the agreements.
- [ ] Register the **App ID**: Identifiers → `com.waybound.travel` (explicit, not wildcard).

## Phase 1 — Firebase iOS app (Google Sign-In)

The iOS client already exists in the Firebase project (`client_type 2`,
`sc7if38gh8kis8kjfoo7gj1djvuo3cvh`, bundle `com.waybound.travel`) — the app.json
Google Sign-In plugin (`iosUrlScheme`) and `src/services/googleSignIn.ts`
(`GOOGLE_IOS_CLIENT_ID`) are already wired. Remaining:

- [ ] Firebase console → project `verba-ai-98eaf` → Project settings → **iOS app**
      (`com.waybound.travel`) → **Download GoogleService-Info.plist**.
- [ ] Place it at repo root as `GoogleService-Info.plist`.
- [ ] Add to `app.json` so EAS prebuild copies it into the Xcode project:
      ```json
      "ios": {
        "bundleIdentifier": "com.waybound.travel",
        "googleServicesFile": "./GoogleService-Info.plist",
        "infoPlist": {
          "NSUserTrackingUsageDescription": "Your data is used to deliver relevant ads and measure app performance.",
          "SKAdNetworkItems": []
        }
      }
      ```
- [ ] Enable the **Google** provider in Firebase Authentication (Sign-in methods) if
      not already done for Android.

## Phase 2 — Build & test (EAS)

- [ ] `npx eas-cli login` and `npx eas-cli build:configure`.
- [ ] **Apple credentials**: `npx eas-cli credentials` → iOS → create an Apple
      Distribution certificate + provisioning profile (EAS stores them). Requires
      your Apple Developer team.
- [ ] Build: `npx eas-cli build --platform ios --profile preview` (internal) → install
      on a device, and **verify Google Sign-In works on iOS** (it uses the native
      flow + `iosClientId`).
- [ ] `npx eas-cli build --platform ios --profile production` → submit `.ipa` to
      App Store Connect (or use `npx eas-cli submit --platform ios`).

## Phase 3 — App Store Connect metadata

- [ ] Create the app record (App Store Connect → My Apps → **+**): name, `com.waybound.travel`,
      primary language, SKU.
- [ ] **Privacy Policy URL** — REQUIRED (you have accounts, ads, and analytics).
      Host one (e.g. GitHub Pages or your domain) and paste the URL.
- [ ] Screenshots: 6.7", 6.5", and 5.5" (and iPad if supported). Portrait is fine.
- [ ] App icon: 1024×1024, no alpha (`assets/icon.png` — replace with the final brand
      icon before release).
- [ ] App description, keywords, category (**Travel**), support URL.
- [ ] **App Privacy** (nutrition labels): declare Identifiers, Contact Info, Usage
      Data, Advertising Data (because of AdMob + PostHog), and any purchases.
- [ ] If **Pro/Mini** is sold via IAP: add the products in App Store Connect and
      configure the same product IDs in RevenueCat for iOS, then test the paywall.

## Phase 4 — Ads / tracking (iOS 14.5+)

- [ ] Add `NSUserTrackingUsageDescription` (in Phase 1's `infoPlist`) — required for
      the App Tracking Transparency prompt before AdMob can use the IDFA.
- [ ] Test that `react-native-google-mobile-ads` shows ads on iOS (the plugin
      requests tracking authorization on first load).
- [ ] Add `SKAdNetworkItems` entries if you need SKAdNetwork attribution reporting
      (AdMob's published list).

## Phase 5 — TestFlight & submission

- [ ] Push the production build to **TestFlight** (`eas submit` or upload via
      Transporter), add internal/external testers, and run through: sign-up,
      email + Google sign-in, sign-out → sign-in (account chooser), delete account,
      itinerary creation, paywall, ads.
- [ ] Submit for review. Common review gotchas to pre-check:
      - Account **deletion** must be available in-app (already implemented).
      - No placeholder/"Lorem ipsum" content on first open.
      - IAP products (if any) must be visible and purchasable in the sandbox.
- [ ] After approval: **release** manually (or phased release).

## Notes

- The browser-based Google fallback also works on iOS (ASWebAuthenticationSession),
  but the **native** flow is the primary path there — it works without an OS account
  on iOS, so it's simpler than Android.
- Everything is configured so `npx expo prebuild` generates the iOS project fresh —
  do **not** hand-edit generated Xcode files.
