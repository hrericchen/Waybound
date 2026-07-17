# Firebase Authentication Setup Guide for Waybound

## Current Status
✅ Code changes completed - Firebase Auth integration is ready
⏳ Waiting for you to complete the Firebase Console setup and place config files

---

## Step-by-Step Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** or select existing project
3. Enter project name: `Waybound` (or your preferred name)
4. Click **Continue** → **Create project**

### 2. Add Android App

1. In Firebase Console, click **Project Settings** (gear icon) → **General**
2. Scroll down to **Your apps** section
3. Click **Add app** → Select **Android** icon
4. Fill in:
   - **Android package name**: `com.waybound.travel`
   - **App nickname**: `Waybound Android`
   - **Debug signing certificate**: Leave empty for now
5. Click **Register app**
6. Download `google-services.json`
7. Place it at: `c:\Users\qifeng\Desktop\Waybound\android\app\google-services.json`

### 3. Add iOS App

1. In the same **Your apps** section, click **Add app** → Select **iOS** icon
2. Fill in:
   - **iOS bundle ID**: `com.waybound.travel`
   - **App nickname**: `Waybound iOS`
   - **App Store ID**: Leave empty
3. Click **Register app**
4. Download `GoogleService-Info.plist`
5. Place it at: `c:\Users\qifeng\Desktop\Waybound\ios\GoogleService-Info.plist`
   - If the `ios` folder doesn't exist, create it

### 4. Enable Email/Password Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **Sign-in method** tab
3. Click **Email/Password**
4. Toggle **Enable** → Click **Save**

### 5. (Optional) Enable Google Sign-In

1. In **Authentication** → **Sign-in method**
2. Click **Google**
3. Toggle **Enable**
4. Enter your support email
5. Click **Save**

### 6. Rebuild the App

Open Command Prompt and run:

```bash
cd c:\Users\qifeng\Desktop\Waybound
npx expo prebuild --clean
npx expo run:android
```

This will:
- Clean old build files
- Regenerate Android/iOS folders with Firebase config
- Build and install the app on your device/emulator

---

## How to Test

### Test Sign Up:
1. Open the app
2. Go to Sign Up
3. Enter email, password, and name
4. Click **Sign Up**
5. Go to Firebase Console → Authentication → Users
6. You should see the new user listed there!

### Test Sign In:
1. Close the app completely
2. Reopen it
3. Sign in with the same email and password
4. You should stay logged in (Firebase persistence)

### Test Admin Login:
- Email: `admin`
- Password: `KylerEric2026`
- This bypasses Firebase and uses local admin account

---

## Troubleshooting

### "Firebase initialization error" in console
- Make sure `google-services.json` is in `android/app/`
- Make sure you ran `npx expo prebuild --clean`

### Users not showing in Firebase Console
- Make sure you enabled Email/Password in Authentication settings
- Check that you're looking in the right Firebase project

### App crashes on startup
- Make sure both config files are in the correct locations
- Try rebuilding: `npx expo prebuild --clean && npx expo run:android`

### Sign in works but doesn't persist
- Firebase should handle this automatically
- Check that you're not clearing app data
- The app also saves to local storage as backup

---

## What's Been Implemented

✅ Firebase Auth integration in `authService.ts`
✅ Firebase initialization in `firebase.ts`
✅ Auth state listener in `AuthContext.tsx`
✅ Android gradle files updated
✅ Fallback to local storage if Firebase fails
✅ Admin login still works (bypasses Firebase)
✅ Community features still work with AsyncStorage
✅ Users appear in Firebase Console Authentication section

---

## Next Steps After Setup

Once Firebase is working:
1. All new sign-ups will appear in Firebase Console
2. Users will stay logged in across app restarts
3. You can manage users in Firebase Console
4. Community features work independently via AsyncStorage

## Firestore Database Setup (For Community Features)

To enable the community features (publishing itineraries, searching users, friends system):

### 1. Enable Firestore
1. In Firebase Console, go to **Firestore Database** (left sidebar)
2. Click **Create Database**
3. Choose **Start in Test Mode**
4. Select a location (e.g., `us-central`)
5. Click **Enable**

### 2. Apply Security Rules
1. Go to **Firestore Database** → **Rules** tab
2. Copy the rules from **`FIRESTORE_RULES.md`** in your project
3. Paste and click **Publish**

### 3. Rebuild the App
```bash
npx expo prebuild --clean
npx expo run:android
```

## Community Features Now Available

✅ **Publish Itineraries** - Users can publish to community
✅ **Search Users** - Find users by name or email
✅ **Friend System** - Send/accept/decline friend requests
✅ **Friends List** - View all friends
✅ **Real-time Data** - All data syncs across devices via Firestore
