'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/supabaseClient';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  storeName?: string;
  role: 'STORE_MANAGER' | 'INVENTORY_LEAD' | 'ASSOCIATE' | 'EVALUATOR';
  isGuest?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  isSupabaseAuth: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string, storeName?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInAsGuest: (name?: string) => void;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'stocksentinel_guest_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isSupabaseAuth = isSupabaseConfigured();

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    if (supabase) {
      // 1. Check existing Supabase session
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (!isMounted) return;
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(mapSupabaseUser(currentSession.user));
        } else {
          // Check local guest session
          checkLocalGuestSession();
        }
        setLoading(false);
      });

      // 2. Listen to Supabase auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        if (newSession?.user) {
          setUser(mapSupabaseUser(newSession.user));
        } else {
          checkLocalGuestSession();
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Supabase is not configured; check demo/guest session asynchronously
      Promise.resolve().then(() => {
        if (!isMounted) return;
        checkLocalGuestSession();
        setLoading(false);
      });
    }

    function checkLocalGuestSession() {
      if (typeof window === 'undefined') return;
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        } catch {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
      }
    }
  }, []);

  function mapSupabaseUser(sbUser: SupabaseUser): AppUser {
    const meta = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      email: sbUser.email || 'user@retail.com',
      name: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Store Associate',
      storeName: meta.store_name || 'Downtown Supercenter #101',
      role: (meta.role as AppUser['role']) || 'STORE_MANAGER',
      isGuest: false,
    };
  }

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Demo authentication mode
      const demoUser: AppUser = {
        id: `usr-${Date.now().toString(36)}`,
        email,
        name: email.split('@')[0],
        storeName: 'Downtown Supercenter #101',
        role: 'STORE_MANAGER',
        isGuest: true,
      };
      setUser(demoUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(demoUser));
      }
      return {};
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        setUser(mapSupabaseUser(data.user));
        setSession(data.session);
      }
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  }, []);

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    name: string,
    storeName?: string
  ): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const demoUser: AppUser = {
        id: `usr-${Date.now().toString(36)}`,
        email,
        name: name || email.split('@')[0],
        storeName: storeName || 'Metro Express #204',
        role: 'STORE_MANAGER',
        isGuest: true,
      };
      setUser(demoUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(demoUser));
      }
      return {};
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            store_name: storeName || 'Store #101',
            role: 'STORE_MANAGER',
          },
        },
      });
      if (error) return { error: error.message };
      if (data.user) {
        setUser(mapSupabaseUser(data.user));
        setSession(data.session);
      }
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        error:
          'Supabase is not configured yet. To use Google OAuth, configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and enable the Google provider in your Supabase dashboard.',
      };
    }

    try {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Google OAuth initialization failed' };
    }
  }, []);

  const signInAsGuest = useCallback((name: string = 'Demo Evaluator') => {
    const guestUser: AppUser = {
      id: `guest-${Date.now().toString(36)}`,
      email: 'evaluator@stocksentinel.ai',
      name,
      storeName: 'Downtown Supercenter #101',
      role: 'EVALUATOR',
      isGuest: true,
    };
    setUser(guestUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        error:
          'Demo Mode: In demo mode password reset is simulated. Provide Supabase credentials to enable email SMTP delivery.',
      };
    }

    try {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?type=recovery`,
      });
      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Password reset failed' };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isSupabaseAuth,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInAsGuest,
      signOut,
      resetPassword,
    }),
    [
      user,
      session,
      loading,
      isSupabaseAuth,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInAsGuest,
      signOut,
      resetPassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
