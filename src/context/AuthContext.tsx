'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/db/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserAccessState } from '@/types';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  accessState?: UserAccessState;
  role: string;
  companyId?: string;
  companyName?: string;
  companySlug?: string;
  companyStatus?: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  assignedStoreId?: string;
  assignedStoreName?: string;
  storeName?: string;
  accessibleStoreIds?: string[];
  avatarUrl?: string;
  authMode?: 'supabase' | 'standalone';
  isDurable?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isLoggingOut: boolean;
  isSupabaseAuth: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string, storeName?: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string; cancelled?: boolean; redirected?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshSession: () => Promise<AppUser | null>;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'stocksentinel_user_profile';

/**
 * Returns authorization headers containing Bearer token from the active Supabase session or standalone cookie,
 * and synchronizes the session into document.cookie for reliable subsequent requests.
 */
export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        if (typeof document !== 'undefined') {
          document.cookie = `stocksentinel_session=${encodeURIComponent(session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        }
        return headers;
      }
    }
  } catch {}

  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/stocksentinel_session=([^;]+)/);
    if (match) {
      const token = decodeURIComponent(match[1].trim()).replace(/^"+|"+$/g, '');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  return headers;
}

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '605266708084-3h78ecdqjt1nh11f7obl8fsojv31befu.apps.googleusercontent.com';

function mapSupabaseUser(sbUser: SupabaseUser): AppUser {
  const meta = sbUser.user_metadata || {};
  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Store Associate',
    storeName: meta.store_name || 'Retail Operations',
    accessState: 'PENDING_ASSIGNMENT',
    role: meta.role || 'PENDING_ASSIGNMENT',
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
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const refreshSession = useCallback(async (): Promise<AppUser | null> => {
    try {
      const supabase = getSupabaseClient();
      const headers: Record<string, string> = {};
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
          if (typeof document !== 'undefined') {
            document.cookie = `stocksentinel_session=${encodeURIComponent(session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
          }
        }
      }

      const res = await fetch('/api/auth/session', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          } catch {}
          return data.user;
        }
      }
      setUser(null);
      try {
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {}
      return null;
    } catch {
      return null;
    }
  }, []);

  // Synchronize session on mount
  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    if (supabase) {
      // Safety timeout: If Supabase connection hangs or takes >1.5s, unblock loading
      const safetyTimeout = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 1500);

      // 1. Check existing Supabase session & fetch verified RBAC state
      supabase.auth
        .getSession()
        .then(async ({ data: { session } }) => {
          clearTimeout(safetyTimeout);
          if (!isMounted) return;
          if (session?.user) {
            if (session.access_token && typeof document !== 'undefined') {
              document.cookie = `stocksentinel_session=${encodeURIComponent(session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
            }
            const mapped = mapSupabaseUser(session.user);
            setUser(mapped);
            try {
              const serverUser = await refreshSession();
              if (isMounted && serverUser) {
                setUser(serverUser);
              }
            } catch {}
          } else {
            setUser(null);
            try {
              localStorage.removeItem(USER_STORAGE_KEY);
            } catch {}
          }
        })
        .catch(() => {
          if (isMounted) setUser(null);
        })
        .finally(() => {
          clearTimeout(safetyTimeout);
          if (isMounted) setLoading(false);
        });

      // 2. Listen to real-time auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          if (session.access_token && typeof document !== 'undefined') {
            document.cookie = `stocksentinel_session=${encodeURIComponent(session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
          }
          const mapped = mapSupabaseUser(session.user);
          setUser(mapped);
          try {
            const serverUser = await refreshSession();
            if (isMounted && serverUser) {
              setUser(serverUser);
            }
          } catch {}
        } else {
          if (typeof document !== 'undefined') {
            document.cookie = 'stocksentinel_session=; path=/; max-age=0; SameSite=Lax';
          }
          setUser(null);
          try {
            localStorage.removeItem(USER_STORAGE_KEY);
          } catch {}
        }
        if (isMounted) setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Standalone fallback: verify local server session
      void (async () => {
        try {
          await refreshSession();
        } finally {
          if (isMounted) setLoading(false);
        }
      })();

      return () => {
        isMounted = false;
      };
    }
  }, [refreshSession]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
          if (data.session?.access_token && typeof document !== 'undefined') {
            document.cookie = `stocksentinel_session=${encodeURIComponent(data.session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
          }
          await refreshSession();
          return {};
        }

        // If Supabase authentication returned an error, attempt fallback to standalone auth
        // (supports demo accounts, existing standalone accounts, and local testing)
        try {
          const fallbackRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok && fallbackData.user) {
            if (fallbackData.token && typeof document !== 'undefined') {
              document.cookie = `stocksentinel_session=${encodeURIComponent(fallbackData.token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
            }
            await refreshSession();
            return {};
          }
        } catch {
          // If fallback fails, surface original error below
        }

        return { error: error?.message || 'Invalid login credentials.' };
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

      if (data.token && typeof document !== 'undefined') {
        document.cookie = `stocksentinel_session=${encodeURIComponent(data.token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
      await refreshSession();
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Network error during sign in.' };
    }
  }, [refreshSession]);

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      storeName?: string
    ): Promise<{ error?: string; needsEmailConfirmation?: boolean }> => {
      const supabase = getSupabaseClient();

      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                store_name: storeName || 'Retail Operations',
              },
            },
          });
          if (error) return { error: error.message };
          if (data.user) {
            if (data.session?.access_token) {
              if (typeof document !== 'undefined') {
                document.cookie = `stocksentinel_session=${encodeURIComponent(data.session.access_token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
              }
              await refreshSession();
              return {};
            }
            // Supabase requires email verification before session is issued
            return { needsEmailConfirmation: true };
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

        if (data.token && typeof document !== 'undefined') {
          document.cookie = `stocksentinel_session=${encodeURIComponent(data.token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        }

        await refreshSession();
        return {};
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Network error during registration.' };
      }
    },
    [refreshSession]
  );

  const signInWithGoogle = useCallback(async (): Promise<{ error?: string; cancelled?: boolean; redirected?: boolean }> => {
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const origin =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const cleanOrigin = origin.replace(/\/+$/, '');

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${cleanOrigin}/auth/callback`,
          },
        });
        if (error) return { error: error.message };
        return { redirected: true };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Supabase Google OAuth initialization failed.' };
      }
    }

    if (typeof window === 'undefined') return {};

    // 1. Google Identity Services Popup (no redirect_uri needed, eliminates redirect_uri_mismatch)
    if (window.google?.accounts?.oauth2) {
      return new Promise<{ error?: string; cancelled?: boolean; redirected?: boolean }>((resolve) => {
        try {
          const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                if (tokenResponse.error === 'popup_closed_by_user') {
                  resolve({ cancelled: true });
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
                    await refreshSession();
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
          resolve({ redirected: true });
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

    return { redirected: true };
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    setIsLoggingOut(true);
    if (typeof document !== 'undefined') {
      document.cookie = 'stocksentinel_session=; path=/; max-age=0; SameSite=Lax';
    }
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
      router.push('/');
      router.refresh();
    }
    setTimeout(() => {
      setIsLoggingOut(false);
    }, 1200);
  }, [router]);

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

  const getAuthHeaders = useCallback(() => getClientAuthHeaders(), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isLoggingOut,
      isSupabaseAuth,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
      refreshSession,
      getAuthHeaders,
    }),
    [user, loading, isLoggingOut, isSupabaseAuth, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword, refreshSession, getAuthHeaders]
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
