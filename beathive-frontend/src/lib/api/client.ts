// src/lib/api/client.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    // Identifikasi request dari frontend resmi (bukan peretas via Postman langsung)
    'X-Requested-With': 'XMLHttpRequest',
  },
  // Timeout 30 detik — cegah hanging requests
  timeout: 30_000,
});

function getToken(key: 'accessToken' | 'refreshToken'): string | null {
  if (typeof window === 'undefined') return null;
  const direct = sessionStorage.getItem(key);
  if (direct) return direct;
  try {
    const raw = sessionStorage.getItem('beathive-auth');
    if (raw) return JSON.parse(raw)?.state?.[key] ?? null;
  } catch { /* ignore */ }
  return null;
}

function updateStoredTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('refreshToken', refreshToken);
  try {
    const raw = sessionStorage.getItem('beathive-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.state.accessToken = accessToken;
      parsed.state.refreshToken = refreshToken;
      sessionStorage.setItem('beathive-auth', JSON.stringify(parsed));
    }
  } catch { /* ignore */ }
}

/**
 * Sanitasi semua string field dalam object secara rekursif.
 * Menghapus karakter berbahaya XSS sebelum data dikirim ke server.
 * Note: server juga melakukan sanitasi — ini defence-in-depth.
 */
function sanitizeRequestData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Hapus karakter HTML berbahaya
    return data.replace(/[<>]/g, '').trim();
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeRequestData);
  }
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Jangan sanitasi password, token, dan field sensitif
      const skipSanitize = ['password', 'currentPassword', 'newPassword', 'token', 'refreshToken', 'accessToken', 'code'];
      result[key] = skipSanitize.includes(key) ? value : sanitizeRequestData(value);
    }
    return result;
  }
  return data;
}

// FE-01: Mutex to prevent concurrent /auth/refresh calls.
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

// Request interceptor — inject access token + sanitasi data
apiClient.interceptors.request.use((config) => {
  const token = getToken('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Sanitasi JSON body (bukan FormData — multipart tidak disanitasi di sini)
  if (config.data && !(config.data instanceof FormData) && typeof config.data === 'object') {
    config.data = sanitizeRequestData(config.data);
  }

  return config;
});

// Response interceptor — auto refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        })
        .catch((err) => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = getToken('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

      updateStoredTokens(data.accessToken, data.refreshToken);
      apiClient.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
      flushQueue(null, data.accessToken);

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(original);
    } catch (err) {
      flushQueue(err, null);
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('beathive-auth');
      try {
        const { useAuthStore } = await import('@/lib/store/auth.store');
        useAuthStore.getState().logout();
      } catch { /* ignore if store not available */ }
      window.location.href = '/auth/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

