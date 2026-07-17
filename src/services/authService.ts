import storageService from './storageService';
import { User } from '../types';
import { communityService } from './communityService';
import { getFirebaseAuth } from './firebase';

const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = 'KylerEric2026';

const AUTH_USERS_KEY = 'AUTH_USERS';

export type AppUser = User & { isAdmin?: boolean; avatarUrl?: string };

const authService = {
  async signIn(email: string, password: string) {
    // Admin login check
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      const adminUser: AppUser = {
        id: 'admin-001',
        email: 'admin@waybound.app',
        name: 'Admin',
        isAdmin: true,
      };
      await storageService.save(storageService.STORAGE_KEYS.USER, adminUser);
      return adminUser;
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
  async signInWithGoogle(opts?: {
    idToken?: string;
    profile?: { id?: string; email?: string; name?: string };
  }) {
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