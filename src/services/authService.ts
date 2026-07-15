import storageService from './storageService';
import { User } from '../types';

const authService = {
  async signIn(email: string, password: string) {
    const stored = await storageService.load(storageService.STORAGE_KEYS.USER);
    if (stored && stored.email === email) return stored as User;
    const user: User = { id: `${Date.now()}`, email, name: email.split('@')[0] };
    await storageService.save(storageService.STORAGE_KEYS.USER, user);
    return user;
  },

  async signUp(email: string, password: string, name?: string) {
    const user: User = { id: `${Date.now()}`, email, name: name || email.split('@')[0] };
    await storageService.save(storageService.STORAGE_KEYS.USER, user);
    return user;
  },

  async signOut() {
    await storageService.save(storageService.STORAGE_KEYS.USER, null);
  },

  async getCurrentUser() {
    return (await storageService.load(storageService.STORAGE_KEYS.USER)) as User | null;
  },

  // Sign in with Google — falls back to local storage (Firebase Auth requires native setup).
  async signInWithGoogle(opts?: {
    idToken?: string;
    profile?: { id?: string; email?: string; name?: string };
  }) {
    const user: User = {
      id: opts?.profile?.id || `${Date.now()}`,
      email: opts?.profile?.email || 'google.user@example.com',
      name: opts?.profile?.name || 'Google User',
    };
    await storageService.save(storageService.STORAGE_KEYS.USER, user);
    return user;
  },
};

export default authService;
