import React, { createContext, useEffect, useState } from 'react';
import { User } from '../types';
import authService, { AppUser } from '../services/authService';
import { getFirebaseAuth } from '../services/firebase';
import storageService from '../services/storageService';

type GoogleSignInPayload = {
  idToken?: string;
  profile?: { id?: string; email?: string; name?: string };
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (payload: GoogleSignInPayload) => Promise<void>;
  setItineraryFeatured: (id: string, featured: boolean) => Promise<void>;
  getFeaturedItineraries: () => Promise<any[]>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get cached user first
    authService.getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });

    // Listen to Firebase auth state changes
    try {
      const firebaseAuth = getFirebaseAuth();
      const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          const user: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            isAdmin: false,
          };
          await authService.getCurrentUser().then(cached => {
            if (cached?.isAdmin) user.isAdmin = true;
          });
          await storageService.save(storageService.STORAGE_KEYS.USER, user);
          setUser(user);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Firebase auth state listener failed:', e);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const u = await authService.signIn(email, password);
    setUser(u);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const u = await authService.signUp(email, password, name);
    setUser(u);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const signInWithGoogle = async (payload: GoogleSignInPayload) => {
    // Uses authService.signInWithGoogle to integrate with Firebase or local fallback.
    if ((authService as any).signInWithGoogle) {
      const u = await (authService as any).signInWithGoogle(payload);
      setUser(u);
    }
  };

  const setItineraryFeatured = async (id: string, featured: boolean) => {
    await authService.setItineraryFeatured(id, featured);
  };

  const getFeaturedItineraries = async () => {
    return authService.getFeaturedItineraries();
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, setItineraryFeatured, getFeaturedItineraries }}>{children}</AuthContext.Provider>;
};
