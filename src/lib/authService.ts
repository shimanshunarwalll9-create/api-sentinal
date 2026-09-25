import { getApiUrl, getAuthHeaders } from './api';
import { supabase } from './supabaseClient';
import type { UserAccount } from '../types/sentinel';

export interface AuthResult {
  success: boolean;
  user?: UserAccount;
  token?: string;
  error?: string;
}

export const authService = {
  /**
   * Register a new operator account via Supabase Auth
   */
  async signUp(params: {
    fullName: string;
    email: string;
    password: string;
    organization?: string;
  }): Promise<AuthResult> {
    const { fullName, email, password, organization } = params;
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanOrg = (organization || 'Security Operations Center').trim();

    // 1. Try Sentinel Authentication Gateway
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          password,
          organization: cleanOrg,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('sentinel_auth_token', data.token);
          if (data.user) {
            localStorage.setItem('sentinel_user', JSON.stringify(data.user));
          }
          return { success: true, user: data.user, token: data.token };
        }
        return { success: false, error: data.error || 'Failed to create operator account' };
      }

      // If gateway returned a non-JSON response (e.g. 404 or 502 HTML)
      if (!res.ok) {
        console.warn(`[Sentinel Gateway] Returned non-JSON status ${res.status}: ${res.statusText}`);
      }
    } catch (networkErr: any) {
      console.warn('[Sentinel Gateway] Network error reaching /api/auth/register:', networkErr?.message);
    }

    // 2. Direct Supabase Client fallback (if client-side Supabase credentials are configured)
    if (supabase) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              organization: cleanOrg,
              role: 'analyst',
            },
          },
        });

        if (sbError) {
          return { success: false, error: sbError.message };
        }

        if (sbData.user) {
          const userAccount: UserAccount = {
            id: sbData.user.id,
            email: sbData.user.email || cleanEmail,
            fullName: cleanName,
            role: 'analyst',
            organization: cleanOrg,
            createdAt: sbData.user.created_at,
          };

          const token = sbData.session?.access_token || ('tok-' + Math.random().toString(36).substring(2) + Date.now());
          localStorage.setItem('sentinel_auth_token', token);
          localStorage.setItem('sentinel_user', JSON.stringify(userAccount));
          return { success: true, user: userAccount, token };
        }
      } catch (sbErr: any) {
        return { success: false, error: sbErr?.message || 'Supabase authentication failed' };
      }
    }

    return {
      success: false,
      error: 'Unable to connect to Sentinel authentication gateway. Please verify API configuration.',
    };
  },

  /**
   * Authenticate an existing operator
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Try Sentinel Authentication Gateway
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('sentinel_auth_token', data.token);
          if (data.user) {
            localStorage.setItem('sentinel_user', JSON.stringify(data.user));
          }
          return { success: true, user: data.user, token: data.token };
        }
        return { success: false, error: data.error || 'Authentication failed. Please check credentials.' };
      }
    } catch (networkErr: any) {
      console.warn('[Sentinel Gateway] Network error reaching /api/auth/login:', networkErr?.message);
    }

    // 2. Direct Supabase Client fallback
    if (supabase) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (sbError) {
          return { success: false, error: sbError.message };
        }

        if (sbData.user) {
          const userAccount: UserAccount = {
            id: sbData.user.id,
            email: sbData.user.email || cleanEmail,
            fullName: sbData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            role: (sbData.user.user_metadata?.role as any) || 'analyst',
            organization: sbData.user.user_metadata?.organization || 'Security Operations Center',
            createdAt: sbData.user.created_at,
          };

          const token = sbData.session?.access_token || ('tok-' + Math.random().toString(36).substring(2) + Date.now());
          localStorage.setItem('sentinel_auth_token', token);
          localStorage.setItem('sentinel_user', JSON.stringify(userAccount));
          return { success: true, user: userAccount, token };
        }
      } catch (sbErr: any) {
        return { success: false, error: sbErr?.message || 'Supabase authentication failed' };
      }
    }

    return {
      success: false,
      error: 'Unable to connect to Sentinel authentication gateway. Please verify API configuration.',
    };
  },

  /**
   * Check current active session
   */
  async getCurrentUser(): Promise<UserAccount | null> {
    const token = localStorage.getItem('sentinel_auth_token');
    if (!token) return null;

    try {
      const res = await fetch(getApiUrl('/api/auth/me'), {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('sentinel_user', JSON.stringify(data.user));
          return data.user;
        }
      }
    } catch {
      // Fallback to cached profile if available
    }

    // Fallback: check stored local cache
    const cached = localStorage.getItem('sentinel_user');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    return null;
  },

  /**
   * Sign out operator and invalidate session
   */
  async signOut(): Promise<void> {
    const token = localStorage.getItem('sentinel_auth_token');
    if (token) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: getAuthHeaders(),
        });
      } catch {
        // non-blocking
      }
    }

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // non-blocking
      }
    }

    localStorage.removeItem('sentinel_auth_token');
    localStorage.removeItem('sentinel_user');
  },
};
