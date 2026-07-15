Firebase Native Setup — Android

1. Place `google-services.json` in `android/app/`.
2. In `android/build.gradle` add classpath:

   buildscript {
     dependencies {
       classpath 'com.google.gms:google-services:4.3.15'
     }
   }

3. In `android/app/build.gradle` add at bottom:

   apply plugin: 'com.google.gms.google-services'

4. If using `@react-native-firebase/auth`, ensure your `AndroidManifest.xml` has internet permission and your SHA-1 is added in Firebase console for Google sign-in.

5. Run `npx expo prebuild` and then build via Android Studio or `./gradlew assembleDebug`.
