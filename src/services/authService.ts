import storageService from './storageService';
import { User } from '../types';
import { communityService } from './communityService';
import { getFirebaseAuth } from './firebase';
import auth from '@react-native-firebase/auth';


const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = 'KylerEric2026';

const TEST_EMAIL = 'test';
const TEST_PASSWORD = 'WayboundApp2026';

// No additional test accounts - only test and admin

const AUTH_USERS_KEY = 'AUTH_USERS';

export type AppUser = User & { isAdmin?: boolean; avatarUrl?: string };

// Helper: ensure a mock/test account is also backed by a real Firebase Auth
// user, so that Firestore security rules (which require request.auth) pass.
// We sign in with a deterministic Firebase email/password derived from the
// mock account; if the account doesn't exist yet in Firebase, we create it.
// The returned Firebase UID is used as the app user's id so that
// `request.auth.uid` matches `authorId` on documents this user creates.
async function ensureFirebaseBackedUser(
  firebaseEmail: string,
  firebasePassword: string,
  fallback: { id: string; email: string; name: string; isAdmin?: boolean }
): Promise<AppUser> {
  try {
    const firebaseAuth = getFirebaseAuth();
    let credential;
    try {
      credential = await firebaseAuth.signInWithEmailAndPassword(firebaseEmail, firebasePassword);
    } catch (signInError: any) {
      // Any sign-in failure (user not found, invalid credentials, invalid
      // login, wrong password, etc.) is treated as "this Firebase account
      // doesn't exist yet under this password" and we attempt to create it.
      // If creation also fails (e.g. it already exists under a DIFFERENT
      // password), the outer catch below falls back to a local-only user so
      // the app remains usable offline / without Firestore sync.
      try {
        credential = await firebaseAuth.createUserWithEmailAndPassword(firebaseEmail, firebasePassword);
        if (credential.user) {
          await credential.user.updateProfile({ displayName: fallback.name });
        }
      } catch (createError) {
        throw createError;
      }
    }

    const firebaseUser = credential?.user;
    if (firebaseUser) {
      const user: AppUser = {
        id: firebaseUser.uid,
        email: fallback.email,
        name: fallback.name,
        isAdmin: fallback.isAdmin || false,
      };

      // Make sure this user is registered in the community users collection
      try {
        await communityService.registerUser({
          id: user.id,
          name: user.name,
          email: user.email,
        });
      } catch (e) {
        console.warn('Failed to register mock user in community', e);
      }

      await storageService.save(storageService.STORAGE_KEYS.USER, user);
      return user;
    }
  } catch (e) {
    console.warn('Firebase-backed mock login failed, using local fallback:', e);
  }

  // Fallback: local-only user (Firestore writes will fail permission checks,
  // but the rest of the app keeps working via local storage fallbacks).
  const localUser: AppUser = {
    id: fallback.id,
    email: fallback.email,
    name: fallback.name,
    isAdmin: fallback.isAdmin || false,
  };
  await storageService.save(storageService.STORAGE_KEYS.USER, localUser);
  return localUser;
}

const authService = {
  async signIn(email: string, password: string) {
    // Admin login check
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      return ensureFirebaseBackedUser('admin@waybound.app', ADMIN_PASSWORD, {
        id: 'admin-001',
        email: 'admin@waybound.app',
        name: 'Admin',
        isAdmin: true,
      });
    }

    // Test user login check
    if (email.toLowerCase() === TEST_EMAIL.toLowerCase() && password === TEST_PASSWORD) {
      return ensureFirebaseBackedUser('test@waybound.app', TEST_PASSWORD, {
        id: 'test-001',
        email: 'test@waybound.app',
        name: 'Test User',
        isAdmin: false,
      });
    }

    // Try Firebase Auth first
    try {
      const firebaseAuth = getFirebaseAuth();
      const credential = await firebaseAuth.signInWithEmailAndPassword(email, password);
      const firebaseUser = credential.user;
      
      if (firebaseUser) {
        const user: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || email,
          name: firebaseUser.displayName || email.split('@')[0],
          isAdmin: false,
        };
        await storageService.save(storageService.STORAGE_KEYS.USER, user);
        return user;
      }
    } catch (firebaseError) {
      console.warn('Firebase sign in failed, trying local:', firebaseError);
    }

    // Fallback to local auth users
    const authUsers = (await storageService.load(AUTH_USERS_KEY)) || [];
    const matched = authUsers.find(
      (u: any) => u.email === email && u.password === password
    );

    if (matched) {
      const user: AppUser = {
        id: matched.id,
        email: matched.email,
        name: matched.name || matched.email.split('@')[0],
        isAdmin: false,
      };
      await storageService.save(storageService.STORAGE_KEYS.USER, user);
      return user;
    }

    throw new Error('Invalid email or password');
  },

  async signUp(email: string, password: string, name?: string) {
    // Try Firebase Auth first
    let firebaseUid: string | null = null;
    try {
      const firebaseAuth = getFirebaseAuth();
      const credential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      firebaseUid = credential.user?.uid || null;
      
      // Update display name if provided
      if (name && credential.user) {
        await credential.user.updateProfile({ displayName: name });
      }
    } catch (firebaseError) {
      console.warn('Firebase sign up failed, using local:', firebaseError);
    }

    // Register in persistent auth users list
    const authUsers = (await storageService.load(AUTH_USERS_KEY)) || [];
    const userId = firebaseUid || `user-${Date.now()}`;
    const existing = authUsers.find((u: any) => u.email === email);
    if (!existing) {
      authUsers.push({
        id: userId,
        email,
        password,
        name: name || email.split('@')[0],
        createdAt: Date.now(),
      });
      await storageService.save(AUTH_USERS_KEY, authUsers);
    }

    const user: AppUser = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      isAdmin: false,
    };

    // Register in community users list
    try {
      await communityService.registerUser({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (e) {
      console.warn('Failed to register in community', e);
    }

    await storageService.save(storageService.STORAGE_KEYS.USER, user);
    return user;
  },

  async signOut() {
    try {
      const firebaseAuth = getFirebaseAuth();
      await firebaseAuth.signOut();
    } catch (e) {
      console.warn('Firebase sign out failed:', e);
    }
    await storageService.save(storageService.STORAGE_KEYS.USER, null);
  },

  async getCurrentUser() {
    return (await storageService.load(storageService.STORAGE_KEYS.USER)) as AppUser | null;
  },

  // Sign in with Google
  // Authenticates against Firebase Auth using the Google idToken so that
  // request.auth.uid is populated and matches Firestore security rules
  // (which require request.auth != null for writes). Without this,
  // Firestore writes (e.g. publishItinerary) fail with permission-denied
  // because the app user was only stored locally and never actually signed
  // into Firebase.
  async signInWithGoogle(opts?: {
    idToken?: string;
    profile?: { id?: string; email?: string; name?: string };
  }) {
    if (opts?.idToken) {
      try {
        const firebaseAuth = getFirebaseAuth();
        const googleCredential = auth.GoogleAuthProvider.credential(opts.idToken);
        const credential = await firebaseAuth.signInWithCredential(googleCredential);
        const firebaseUser = credential.user;

        if (firebaseUser) {
          const user: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || opts?.profile?.email || 'google.user@example.com',
            name: firebaseUser.displayName || opts?.profile?.name || 'Google User',
            isAdmin: false,
          };

          try {
            await communityService.registerUser({
              id: user.id,
              name: user.name,
              email: user.email,
            });
          } catch (e) {
            console.warn('Failed to register in community', e);
          }

          await storageService.save(storageService.STORAGE_KEYS.USER, user);
          return user;
        }
      } catch (e) {
        console.warn('Firebase Google sign-in failed, using local fallback:', e);
      }
    }

    // Fallback: local-only user (Firestore writes will fail permission
    // checks, but the rest of the app keeps working via local storage
    // fallbacks).
    const user: AppUser = {
      id: opts?.profile?.id || `${Date.now()}`,
      email: opts?.profile?.email || 'google.user@example.com',
      name: opts?.profile?.name || 'Google User',
      isAdmin: false,
    };

    try {
      await communityService.registerUser({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (e) {
      console.warn('Failed to register in community', e);
    }

    await storageService.save(storageService.STORAGE_KEYS.USER, user);
    return user;
  },


  async setItineraryFeatured(itineraryId: string, featured: boolean) {
    const list = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
    const idx = list.findIndex((i: any) => i.id === itineraryId);
    if (idx >= 0) {
      list[idx].featured = featured;
      await storageService.save('COMMUNITY_ITINERARIES', list);
    }
  },

  async getFeaturedItineraries() {
    const list = (await storageService.load('COMMUNITY_ITINERARIES')) || [];
    return list.filter((i: any) => i.featured).sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
};

export default authService;
