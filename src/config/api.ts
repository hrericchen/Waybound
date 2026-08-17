import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolve the backend origin during development.
 *
 * In Expo dev, `Constants.expoConfig.hostUri` (e.g. "192.168.1.20:8081") is the
 * Metro bundler host — i.e. the dev machine's LAN address. That host is
 * reachable from Android emulators, iOS simulators, AND physical devices on the
 * same Wi-Fi, so we point the backend at `http://<that host>:3000` instead of
 * `http://localhost:3000` (which a physical device would interpret as itself).
 */
function resolveDevOrigin(): string {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).expoGoConfig?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;
    const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : null;
    if (host) return `http://${host}:3000`;
  } catch (e) {
    // fall through to platform defaults
  }
  // Android emulator: 10.0.2.2 is the host machine's loopback.
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

/** Backend origin (no trailing slash), e.g. "http://192.168.1.20:3000". */
export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  : typeof __DEV__ !== 'undefined' && __DEV__
  ? resolveDevOrigin()
  : 'https://your-production-backend.com';

/** Backend API base, e.g. "http://192.168.1.20:3000/api". */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/**
 * HTTPS redirect URI for the Google OAuth browser fallback. Google only accepts
 * real HTTP(S) redirect URIs, so this points at the deployed backend's
 * /oauth2redirect endpoint (which bounces the code/state back into the app via
 * the com.waybound.travel custom scheme).
 *
 * Set EXPO_PUBLIC_OAUTH_REDIRECT_URL to your deployed backend, e.g.
 * https://waybound-backend.onrender.com/oauth2redirect, and register that exact
 * URL as an authorized redirect URI on the Web OAuth client in Google Cloud.
 */
export const GOOGLE_OAUTH_REDIRECT_URL =
  process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL ||
  'https://REPLACE-WITH-YOUR-BACKEND.onrender.com/oauth2redirect';
