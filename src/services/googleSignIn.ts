import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Web client ID (OAuth 2.0 "Web application" client, client_type 3 in
// google-services.json). Required by @react-native-google-signin on Android so
// it returns an idToken we can exchange with Firebase.
export const GOOGLE_WEB_CLIENT_ID =
  '732997491914-eotvgdvv430gsu16i978clqg1577gicm.apps.googleusercontent.com';

// iOS client ID (client_type 2 in google-services.json, bundle com.waybound.travel).
// Required on iOS so the native Google Sign-In returns an idToken Firebase accepts.
export const GOOGLE_IOS_CLIENT_ID =
  '732997491914-sc7if38gh8kis8kjfoo7gj1djvuo3cvh.apps.googleusercontent.com';

let configured = false;

/** Idempotent wrapper around GoogleSignin.configure. */
export async function configureGoogleSignIn(): Promise<void> {
  if (configured) return;
  await GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email'],
  });
  configured = true;
}

/**
 * Clears the native Google Sign-In SDK's saved account so the next
 * `GoogleSignin.signIn()` shows the account chooser again instead of silently
 * re-signing in with the previously used account.
 *
 * Safe to call even if the SDK was never configured (e.g. the user never opened
 * the Sign-In screen) — failures are swallowed and logged.
 */
export async function signOutGoogleSignIn(): Promise<void> {
  try {
    await configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (e) {
    // Never let clearing Google state break the app's own sign-out.
    console.warn('[GoogleSignIn] signOut failed:', e);
  }
}
