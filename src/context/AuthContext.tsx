'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  storeName?: string;
  role: 'STORE_MANAGER' | 'INVENTORY_LEAD' | 'ASSOCIATE' | 'EVALUATOR';
  avatarUrl?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isSupabaseAuth: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string, storeName?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'stocksentinel_user_profile';

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '605266708084-3h78ecdqjt1nh11f7obl8fsojv31befu.apps.googleusercontent.com';

function mapSupabaseUser(sbUser: SupabaseUser): AppUser {
  const meta = sbUser.user_metadata || {};
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Store Associate',
    storeName: meta.store_name || 'Retail Supercenter',
    role: (meta.role as AppUser['role']) || 'STORE_MANAGER',
    avatarUrl: meta.avatar_url || meta.picture,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isSupabaseAuth = isSupabaseConfigured();

  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(USER_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.email) return parsed;
        }
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Synchronize session on mount
  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    if (supabase) {
      // 1. Check existing Supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          const mapped = mapSupabaseUser(session.user);
          setUser(mapped);
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          } catch {}
        } else {
          setUser(null);
          try {
            localStorage.removeItem(USER_STORAGE_KEY);
          } catch {}
        }
        setLoading(false);
      });

      // 2. Listen to real-time auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          const mapped = mapSupabaseUser(session.user);
          setUser(mapped);
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          } catch {}
        } else {
          setUser(null);
          try {
            localStorage.removeItem(USER_STORAGE_KEY);
          } catch {}
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Standalone fallback: verify local server session
      fetch('/api/auth/session')
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.user) {
            setUser(data.user);
            try {
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            } catch {}
          } else {
            try {
              localStorage.removeItem(USER_STORAGE_KEY);
            } catch {}
            setUser(null);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        if (data.user) {
          const mapped = mapSupabaseUser(data.user);
          setUser(mapped);
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          } catch {}
        }
        return {};
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Supabase authentication failed.' };
      }
    }

    // Standalone fallback
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error || 'Failed to sign in.' };
      }

      setUser(data.user);
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      } catch {}

      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Network error during sign in.' };
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string, storeName?: string): Promise<{ error?: string }> => {
      const supabase = getSupabaseClient();

      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                store_name: storeName || 'Retail Supercenter',
                role: 'STORE_MANAGER',
              },
            },
          });
          if (error) return { error: error.message };
          if (data.user) {
            const mapped = mapSupabaseUser(data.user);
            setUser(mapped);
            try {
              localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
            } catch {}
          }
          return {};
        } catch (err: unknown) {
          return { error: err instanceof Error ? err.message : 'Supabase registration failed.' };
        }
      }

      // Standalone fallback
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, storeName }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          return { error: data.error || 'Failed to create account.' };
        }

        setUser(data.user);
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        } catch {}

        return {};
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Network error during registration.' };
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();

    if (supabase) {
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
        return { error: err instanceof Error ? err.message : 'Supabase Google OAuth initialization failed.' };
      }
    }

    if (typeof window === 'undefined') return {};

    // 1. Google Identity Services Popup (no redirect_uri needed, eliminates redirect_uri_mismatch)
    if (window.google?.accounts?.oauth2) {
      return new Promise<{ error?: string }>((resolve) => {
        try {
          const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                if (tokenResponse.error === 'popup_closed_by_user') {
                  resolve({});
                  return;
                }
                resolve({ error: tokenResponse.error_description || tokenResponse.error });
                return;
              }

              if (tokenResponse.access_token) {
                try {
                  const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                  });
                  const profile = await gRes.json();
                  if (!profile.email) {
                    resolve({ error: 'Could not obtain email address from Google profile.' });
                    return;
                  }

                  const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: profile.email,
                      name: profile.name,
                      picture: profile.picture,
                      sub: profile.sub,
                    }),
                  });

                  const data = await res.json();
                  if (data.user) {
                    localStorage.setItem('stocksentinel_user_profile', JSON.stringify(data.user));
                    setUser(data.user);
                    router.push('/dashboard');
                    resolve({});
                  } else {
                    resolve({ error: data.error || 'Failed to authenticate Google user.' });
                  }
                } catch (err: unknown) {
                  resolve({
                    error: err instanceof Error ? err.message : 'Google authentication processing failed.',
                  });
                }
              }
            },
          });

          tokenClient.requestAccessToken({ prompt: 'select_account' });
        } catch {
          // Fallback to standard redirect
          const origin = window.location.origin;
          const redirectUri = `${origin}/auth/callback`;
          const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
            GOOGLE_CLIENT_ID
          )}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Date.now()}`;
          window.location.href = oauthUrl;
          resolve({});
        }
      });
    }

    // 2. Direct Google OAuth fallback via redirect
    const origin = window.location.origin;
    const redirectUri = `${origin}/auth/callback`;
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      GOOGLE_CLIENT_ID
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Date.now()}`;
    window.location.href = oauthUrl;

    return {};
  }, [router]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    setUser(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {}
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();

    if (supabase) {
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
        return { error: err instanceof Error ? err.message : 'Supabase password reset failed.' };
      }
    }

    // Standalone fallback
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error || 'Failed to process password reset.' };
      }
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Network error.' };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isSupabaseAuth,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
    }),
    [user, loading, isSupabaseAuth, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword]
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
