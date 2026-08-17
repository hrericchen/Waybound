import React, { createContext, useEffect, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
import authService, { AppUser, getAccountSuspension } from '../services/authService';
import { getFirebaseAuth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import storageService from '../services/storageService';
import { posthog } from '../config/posthog';


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
  deleteAccount: () => Promise<void>;
  signInWithGoogle: (payload: GoogleSignInPayload) => Promise<void>;
  setItineraryFeatured: (id: string, featured: boolean) => Promise<void>;
  getFeaturedItineraries: () => Promise<any[]>;
  updateUser: (fields: Partial<AppUser>) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;

    if (user?.id) {
      if (identifiedUserId.current === user.id) return;

      if (identifiedUserId.current) {
        posthog.reset();
      }

      posthog.identify(user.id, {
        $set: {
          email: user.email,
          name: user.name,
          is_admin: Boolean(user.isAdmin),
        },
      });
      identifiedUserId.current = user.id;
      return;
    }

    if (identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [user]);

  useEffect(() => {
    // Try to get cached user first
    authService.getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });

    // Listen to Firebase auth state changes
    try {
      const firebaseAuth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {

        if (firebaseUser) {
          const cached = await authService.getCurrentUser();
          // Only inherit cached profile fields (admin/pro/tag/avatar/name) when
          // the cached user is THIS account — never from a previous account
          // that was signed in on the same device.
          const sameAccount = !!cached && cached.id === firebaseUser.uid;
          const user: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: sameAccount
              ? cached?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
              : firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            isAdmin: false,
          };
          if (sameAccount) {
            if (cached?.isAdmin) user.isAdmin = true;
            if (cached?.isPro) user.isPro = true;
            if (cached?.tag) user.tag = cached.tag;
            if (cached?.avatarUrl) user.avatarUrl = cached.avatarUrl;
          }

          // Check Firestore for gifted pro status
          try {
            const { getFirestoreDb } = require('../services/firebase');
            const { doc, getDoc } = require('firebase/firestore');
            const db = getFirestoreDb();
            const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userSnap.exists()) {
              const data = userSnap.data();
              if (data.isPro) user.isPro = true;
              if (data.isMini) user.isMini = true;
              if (data.isAdmin) user.isAdmin = true;
              if (data.tag) user.tag = data.tag;
              if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
              // Moderation flags: a suspended or permanently closed account is
              // gated out of the app by RootNavigator.
              if (data.suspendedUntil) user.suspendedUntil = data.suspendedUntil;
              if (data.deleted) user.deleted = true;
            }
          } catch (e) {
            console.warn('Failed to fetch Firestore user data:', e);
          }
          
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

  // Server-side moderation enforcement: if the account is suspended (or the
  // server confirms the account no longer exists), prompt the user and sign
  // them out. Runs on launch and whenever the app returns to the foreground.
  const moderatedKickRef = useRef(false);
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    const check = async () => {
      try {
        const status = await getAccountSuspension(user.id);
        if (!mounted) return;
        if (status.suspendedUntil && status.suspendedUntil > Date.now()) {
          if (moderatedKickRef.current) return;
          moderatedKickRef.current = true;
          const date = new Date(status.suspendedUntil).toLocaleDateString();
          Alert.alert(
            'Account Suspended',
            `Your account has been suspended until ${date}. If you think this is a mistake, please contact support.`,
            [{ text: 'OK', onPress: () => { signOut(); } }]
          );
        } else if (status.exists === false && status.source === 'server') {
          // The backend confirmed this account no longer exists (deleted).
          if (moderatedKickRef.current) return;
          moderatedKickRef.current = true;
          Alert.alert(
            'Account Closed',
            'This account has been permanently closed. If you think this is a mistake, please contact support.',
            [{ text: 'OK', onPress: () => { signOut(); } }]
          );
        } else {
          moderatedKickRef.current = false;
        }
      } catch (e) {
        // Status check failed (offline / backend down) — never kick in that case.
      }
    };

    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const deleteAccount = async () => {
    const u = await authService.getCurrentUser();
    if (u?.id) {
      await authService.deleteAccount(u.id);
    }
    // Wipe the cached user and let RootNavigator switch to the Auth stack.
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

  const updateUser = async (fields: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...fields };
      storageService.save(storageService.STORAGE_KEYS.USER, updated);
      return updated;
    });
  };

    return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, deleteAccount, signInWithGoogle, setItineraryFeatured, getFeaturedItineraries, updateUser }}>{children}</AuthContext.Provider>;
};
