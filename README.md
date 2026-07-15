# Waybound — Travel Planner (Expo + TypeScript)

This is a starter, production-quality scaffold for a cross-platform travel itinerary app built with Expo, React Native, and TypeScript. It includes navigation, mock data, AsyncStorage-based services, and screens for Splash, Auth, Home, Trip Detail, Create Itinerary, Library, and Profile.

Run:

```bash
npm install
npx expo start
```

Firebase integration points are marked in `src/services/firebase.ts` and relevant service files.

Native Firebase Auth and Maps notes:


```bash
npm install @react-native-firebase/app @react-native-firebase/auth react-native-maps
npx expo prebuild
# then open Xcode/Android Studio to finish native setup
```

Native Firebase prebuild notes:
- Android: see `docs/firebase-setup-android.md` for `google-services.json` and Gradle plugin steps.
- iOS: see `docs/firebase-setup-ios.md` for `GoogleService-Info.plist` and CocoaPods steps.

