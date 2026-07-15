import React, { createContext, useEffect, useState } from 'react';
import { User } from '../types';
import authService from '../services/authService';

type GoogleSignInPayload = {
  idToken?: string;
  profile?: { id?: string; email?: string; name?: string };
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (payload: GoogleSignInPayload) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
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

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle }}>{children}</AuthContext.Provider>;
};
