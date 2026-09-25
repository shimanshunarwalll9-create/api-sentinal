/**
 * API Sentinel Client Configuration
 * Supports same-domain deployment (Vercel fullstack / Docker) as well as
 * decoupled frontend-backend architectures via VITE_API_URL.
 */

// If VITE_API_URL is configured (e.g. backend hosted on Cloud Run or custom domain), use it.
// Otherwise, use relative path "" which works seamlessly on same-origin hosts (e.g. Vercel with serverless /api).
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const token = localStorage.getItem('sentinel_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
