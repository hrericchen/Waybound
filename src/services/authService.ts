import storageService from './storageService';
import { User } from '../types';
import { communityService } from './communityService';
import { sanitizeDisplayName } from '../utils/displayName';
import { getFirebaseAuth, GoogleAuthProvider } from './firebase';
import apiService from './apiService';
import { signOutGoogleSignIn } from './googleSignIn';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';


const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = 'KylerEric2026';

const TEST_EMAIL = 'test';
const TEST_PASSWORD = 'WayboundApp2026';

// No additional test accounts - only test and admin

const AUTH_USERS_KEY = 'AUTH_USERS';

export type AppUser = User & { isAdmin?: boolean; isMini?: boolean; avatarUrl?: string };

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
      credential = await signInWithEmailAndPassword(firebaseAuth, firebaseEmail, firebasePassword);
    } catch (signInError: any) {
      // Any sign-in failure (user not found, invalid credentials, invalid
      // login, wrong password, etc.) is treated as "this Firebase account
      // doesn't exist yet under this password" and we attempt to create it.
      // If creation also fails (e.g. it already exists under a DIFFERENT
      // password), the outer catch below falls back to a local-only user so
      // the app remains usable offline / without Firestore sync.
      try {
        credential = await createUserWithEmailAndPassword(firebaseAuth, firebaseEmail, firebasePassword);
        if (credential.user) {
          await updateProfile(credential.user, { displayName: fallback.name });
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
          isAdmin: fallback.isAdmin || false,
        });
      } catch (e) {
        console.warn('Failed to register mock user in community', e);
      }

      // Server-side moderation: suspended accounts are blocked from signing in.
      try {
        await assertNotSuspended(user.id);
      } catch (e) {
        try {
          await firebaseSignOut(firebaseAuth);
        } catch {}
        throw e;
      }

      await storageService.save(storageService.STORAGE_KEYS.USER, user);
      // Email/mock sign-ups already picked a display name in the sign-up form.
      try {
        await storageService.save(`WB_DISPLAY_NAME_SET_${user.id}`, true);
      } catch (e) {}
      return user;
    }
  } catch (e: any) {
    if (e?.name === 'AccountSuspendedError') {
      throw e;
    }
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
  try {
    await storageService.save(`WB_DISPLAY_NAME_SET_${localUser.id}`, true);
  } catch (e) {}
  return localUser;
}

// ---- Server-side moderation (suspension / deletion enforcement) ----

class AccountSuspendedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountSuspendedError';
  }
}

/**
 * Fetch the account's moderation status. Tries the backend first (server-side,
 * authoritative) and falls back to reading the Firestore user doc when the
 * backend is unreachable. Returns:
 *  - suspendedUntil: 0 when not suspended
 *  - deleted: true when the account was permanently closed
 *  - exists: null when the status could not be determined
 *  - source: 'server' | 'firestore' | 'unknown'
 */
export async function getAccountSuspension(
  uid: string
): Promise<{ suspendedUntil: number; deleted: boolean; exists: boolean | null; source: 'server' | 'firestore' | 'unknown' }> {
  // 1) Backend is authoritative when reachable.
  try {
    const firebaseAuth = getFirebaseAuth();
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) {
      const res = await apiService.getAccountStatus(token);
      if (!res.error && res.data) {
        return {
          suspendedUntil: res.data.suspendedUntil || 0,
          deleted: !!res.data.deleted,
          exists: res.data.exists,
          source: 'server',
        };
      }
    }
  } catch (e) {
    console.warn('[auth] Backend status check unavailable, using Firestore fallback:', e);
  }
  // 2) Fallback: read the user doc directly (client rules allow reads).
  try {
    const { getFirestoreDb } = require('./firebase');
    const { doc, getDoc } = require('firebase/firestore');
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const d = snap.data();
      return { suspendedUntil: d.suspendedUntil || 0, deleted: !!d.deleted, exists: true, source: 'firestore' };
    }
    return { suspendedUntil: 0, deleted: false, exists: false, source: 'firestore' };
  } catch (e) {
    console.warn('[auth] Firestore status fallback failed:', e);
  }
  return { suspendedUntil: 0, deleted: false, exists: null, source: 'unknown' };
}

/** Throw when the account is currently suspended (blocks sign-in). */
export async function assertNotSuspended(uid: string): Promise<void> {
  const { suspendedUntil } = await getAccountSuspension(uid);
  if (suspendedUntil && suspendedUntil > Date.now()) {
    const date = new Date(suspendedUntil).toLocaleDateString();
    throw new AccountSuspendedError(
      `Your account has been suspended until ${date}. If you think this is a mistake, please contact support.`
    );
  }
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
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const firebaseUser = credential.user;

      if (firebaseUser) {
        const user: AppUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || email,
          name: firebaseUser.displayName || email.split('@')[0],
          isAdmin: false,
        };
        // Server-side moderation: suspended accounts are blocked from signing in.
        try {
          await assertNotSuspended(user.id);
        } catch (e) {
          try {
            await firebaseSignOut(firebaseAuth);
          } catch {}
          throw e;
        }
        await storageService.save(storageService.STORAGE_KEYS.USER, user);
        return user;
      }
    } catch (firebaseError: any) {
      // A suspension block must surface to the sign-in screen — never fall
      // back to a local account for a moderated user.
      if (firebaseError?.name === 'AccountSuspendedError') {
        throw firebaseError;
      }
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
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      firebaseUid = credential.user?.uid || null;

      // Update display name if provided
      if (name && credential.user) {
        await updateProfile(credential.user, { displayName: name });
      }

      // Send email verification
      if (credential.user && !credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user);
          console.log('[Auth] Verification email sent to', email);
        } catch (verr) {
          console.warn('[Auth] Failed to send verification email:', verr);
        }
      }
    } catch (firebaseError) {
      console.warn('Firebase sign up failed, using local:', firebaseError);
    }

    // Register in persistent auth users list.
    // Duplicate emails ARE allowed: the same email can have both a Google
    // account and a separate password account (they get different user ids).
    const authUsers = (await storageService.load(AUTH_USERS_KEY)) || [];
    const userId = firebaseUid || `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    authUsers.push({
      id: userId,
      email,
      password,
      name: name || email.split('@')[0],
      createdAt: Date.now(),
    });
    await storageService.save(AUTH_USERS_KEY, authUsers);

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
    // Email sign-up already picked a display name — don't show the Google
    // display-name picker for these accounts.
    try {
      await storageService.save(`WB_DISPLAY_NAME_SET_${userId}`, true);
    } catch (e) {}
    return user;
  },

  async signOut() {
    try {
      const firebaseAuth = getFirebaseAuth();
      await firebaseSignOut(firebaseAuth);
    } catch (e) {
      console.warn('Firebase sign out failed:', e);
    }
    // Also clear the native Google Sign-In SDK so the next "Continue with
    // Google" tap shows the account chooser instead of auto-signing back into
    // the previously used Google account.
    await signOutGoogleSignIn();
    await storageService.save(storageService.STORAGE_KEYS.USER, null);
  },

  /** Resend the email verification link for a Firebase user */
  async sendEmailVerificationForUser(email: string, password: string) {
    try {
      const firebaseAuth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (cred.user && !cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        return true;
      }
      return false;
    } catch (e: any) {
      console.warn('[Auth] Resend verification failed:', e?.code || e);
      throw e;
    }
  },

  /** Check if the current Firebase user's email is verified */
  async isEmailVerified(): Promise<boolean> {
    try {
      const firebaseAuth = getFirebaseAuth();
      await firebaseAuth.currentUser?.reload();
      return firebaseAuth.currentUser?.emailVerified ?? false;
    } catch (e) {
      return false;
    }
  },

    async getCurrentUser() {
    return (await storageService.load(storageService.STORAGE_KEYS.USER)) as AppUser | null;
  },

  /**
   * Permanently delete the user's account and ALL associated data.
   * - Firestore: removes the user document (or marks it deleted) + every
   *   itinerary authored by this user.
   * - Firebase Auth: deletes the auth user (when it matches).
   * - Local storage: wipes EVERYTHING (user, itineraries, community cache,
   *   covers, photos, favorites, settings, etc.) so no trace of the user remains.
   */
  async deleteAccount(userId: string) {
    // 1) Wipe Firestore data tied to this user
    try {
      const { getFirestoreDb } = require('./firebase');
      const {
        doc, deleteDoc, setDoc, collection, query, where, getDocs, writeBatch,
      } = require('firebase/firestore');
      const db = getFirestoreDb();

      // Remove the community user document (fallback to a "deleted" marker if
      // security rules forbid a hard delete).
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (e) {
        try {
          await setDoc(doc(db, 'users', userId), { deleted: true, deletedAt: Date.now() });
        } catch (_) { /* ignore */ }
      }

      // Delete every itinerary authored by this user
      try {
        const q = query(collection(db, 'itineraries'), where('authorId', '==', userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn('[auth] Failed to delete user itineraries from Firestore:', e);
      }
    } catch (e) {
      console.warn('[auth] Firestore account cleanup failed:', e);
    }

    // 2) Delete the Firebase Auth user (only if it's the currently signed-in user)
    try {
      const firebaseAuth = getFirebaseAuth();
      if (firebaseAuth.currentUser?.uid === userId) {
        await firebaseAuth.currentUser.delete();
      }
    } catch (e) {
      // Deleting a Firebase user can fail if credentials are stale; the local
      // wipe below still signs the user out of the app.
      console.warn('[auth] Firebase auth user deletion failed:', e);
    }

    // 3) Wipe ALL local storage (user, itineraries, covers, photos, community cache, …)
    try {
      await storageService.clearAll();
    } catch (e) {
      console.warn('[auth] Failed to clear local storage:', e);
    }

    return true;
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
        const googleCredential = GoogleAuthProvider.credential(opts.idToken);
        const credential = await signInWithCredential(firebaseAuth, googleCredential);
        const firebaseUser = credential.user;

        if (firebaseUser) {
          const user: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || opts?.profile?.email || 'google.user@example.com',
            // Filter offensive/leetspeak names so the community record is clean too.
            name: sanitizeDisplayName(firebaseUser.displayName || opts?.profile?.name || 'Google User').value,
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

          // Server-side moderation: suspended accounts are blocked from signing in.
          try {
            await assertNotSuspended(user.id);
          } catch (e) {
            try {
              await firebaseSignOut(firebaseAuth);
            } catch {}
            throw e;
          }

          await storageService.save(storageService.STORAGE_KEYS.USER, user);
          return user;
        }
      } catch (e: any) {
        if (e?.name === 'AccountSuspendedError') {
          throw e;
        }
        console.warn('Firebase Google sign-in failed, using local fallback:', e);
      }
    }

    // Fallback: local-only user (Firestore writes will fail permission
    // checks, but the rest of the app keeps working via local storage
    // fallbacks).
    const user: AppUser = {
      id: opts?.profile?.id || `${Date.now()}`,
      email: opts?.profile?.email || 'google.user@example.com',
      name: sanitizeDisplayName(opts?.profile?.name || 'Google User').value,
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
    const item = await storageService.loadCommItineraryItem(itineraryId);
    if (item) {
      item.featured = featured;
      await storageService.saveCommItineraryItem(itineraryId, item);
    }
  },

  async getFeaturedItineraries() {
    const list = await storageService.loadAllCommItineraries();
    return list.filter((i: any) => i.featured).sort((a: any, b: any) => b.createdAt - a.createdAt)
      .map((i: any) => {
        if (i.coverImageBase64) {
          return { ...i, coverImage: `data:image/jpeg;base64,${i.coverImageBase64}` };
        }
        return i;
      });
  },
};

export default authService;
