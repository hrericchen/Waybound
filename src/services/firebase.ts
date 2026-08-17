// Uses the Firebase JS SDK's MODULAR API (not the "compat" layer).
//
// Why: firebase/compat/app + firebase/compat/auth relies on browser-only
// globals (indexedDB, window, etc.) to pick a persistence implementation
// when the module is first imported. Under React Native (Hermes / no DOM),
// this code path crashes at import time with:
//   "TypeError: undefined cannot be used as a constructor"
// (it happens because a global class it expects to exist, like `indexedDB`
// or a browser-only Persistence class, is undefined and firebase tries to
// `new` it internally).
//
// The modular SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`)
// does not have that automatic global detection problem, and it also
// provides `initializeAuth` + `getReactNativePersistence` specifically for
// React Native environments (persisting the auth session in
// AsyncStorage instead of indexedDB/localStorage).
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, GoogleAuthProvider } from 'firebase/auth';
// @ts-ignore - react-native subpath has no TS types bundled in this firebase version
import { getReactNativePersistence as getReactNativePersistenceRN } from 'firebase/auth/react-native';

import { getFirestore as getModularFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Values pulled from google-services.json (Android) / Firebase console.
const firebaseConfig = {
  apiKey: 'AIzaSyAhHonB0NPRL1j1ZOvH-xIa-4-lPDfGjow',
  authDomain: 'verba-ai-98eaf.firebaseapp.com',
  projectId: 'verba-ai-98eaf',
  storageBucket: 'verba-ai-98eaf.firebasestorage.app',
  messagingSenderId: '732997491914',
  appId: '1:732997491914:android:c5574e5f8f3fea1e802833',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// On native platforms we must use initializeAuth with the RN persistence
// adapter. On web (react-native-web), fall back to the browser-safe
// getReactNativePersistence import isn't valid, so we just use plain
// initializeAuth without a custom persistence (web has its own default).
let authInstance: ReturnType<typeof initializeAuth> | null = null;
let firestoreInstance: ReturnType<typeof getModularFirestore> | null = null;

function getOrCreateAuthInstance(): ReturnType<typeof initializeAuth> {
  if (authInstance) {
    return authInstance;
  }
  
  try {
    if (Platform.OS === 'web') {
      authInstance = initializeAuth(firebaseApp);
    } else {
      authInstance = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistenceRN(AsyncStorage),
      });
    }
  } catch (e) {
    // initializeAuth throws if called twice (e.g. Fast Refresh). Re-use the
    // existing instance.
    console.warn('[firebase] initializeAuth failed, falling back to getAuth:', e);
    authInstance = getAuth(firebaseApp);
  }
  
  return authInstance;
}

function getOrCreateFirestoreInstance(): ReturnType<typeof getModularFirestore> {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  
  firestoreInstance = getModularFirestore(firebaseApp);
  return firestoreInstance;
}

export function getFirebaseAuth() {
  return getOrCreateAuthInstance();
}

export function getFirestoreDb() {
  return getOrCreateFirestoreInstance();
}

export { GoogleAuthProvider };

export default firebaseApp;
