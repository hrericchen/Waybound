// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Fix: Firebase JS SDK double-instance ("Component auth has not been
// registered yet")
//
// The Firebase JS SDK ships separate ESM and CJS builds per @firebase/*
// package. Metro's package-exports resolution loads the ESM build for some
// consumers (e.g. `import ... from 'firebase/app'`) and the CJS build for
// others (e.g. `require('@firebase/app')` inside @firebase/auth's RN build).
//
// The result is TWO @firebase/app instances in the bundle: initializeApp()
// runs on the ESM instance while registerAuth() runs on the CJS instance, so
// Firebase auth is never registered on the app that's actually used and
// initializeAuth() throws "Component auth has not been registered yet"
// (breaking Google / email sign-in).
//
// Force every @firebase/* package to a single CJS build so there is exactly
// one app instance and one auth registration. @firebase/auth and its
// react-native subpath are both pinned to the RN build (which exports
// getReactNativePersistence AND registers the auth component).
// ---------------------------------------------------------------------------
const FORCE_FIREBASE_CJS = {
  '@firebase/app': path.resolve(__dirname, 'node_modules/@firebase/app/dist/index.cjs.js'),
  '@firebase/component': path.resolve(__dirname, 'node_modules/@firebase/component/dist/index.cjs.js'),
  '@firebase/logger': path.resolve(__dirname, 'node_modules/@firebase/logger/dist/index.cjs.js'),
  '@firebase/util': path.resolve(__dirname, 'node_modules/@firebase/util/dist/index.cjs.js'),
  '@firebase/auth': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),
  '@firebase/auth/react-native': path.resolve(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCE_FIREBASE_CJS[moduleName]) {
    return { filePath: FORCE_FIREBASE_CJS[moduleName], type: 'sourceFile' };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

