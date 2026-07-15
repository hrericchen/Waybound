Firebase Native Setup — iOS

1. Place `GoogleService-Info.plist` in `ios/` (or add to your Xcode project).
2. If using `@react-native-firebase`, run `pod install` in the iOS project folder.
3. Add your OAuth redirect URIs and reversed client ID in the Xcode project as needed for Google sign-in.
4. Run the app from Xcode or use `npx expo prebuild` then Xcode to open the generated workspace.
