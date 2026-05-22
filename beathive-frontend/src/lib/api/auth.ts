// src/lib/api/auth.ts
import { apiClient } from './client';
import type { User, AuthTokens } from '@/types';

export const authApi = {
  register: async (name: string, email: string, password: string) => {
    const { data } = await apiClient.post('/auth/register', { name, email, password });
    return data as { user: User } & AuthTokens;
  },

  login: async (email: string, password: string, totpToken?: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password, totpToken });
    return data as ({ user: User } & AuthTokens) | { requiresTwoFactor: true; userId: string };
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  exchangeCode: async (code: string) => {
    const { data } = await apiClient.post('/auth/exchange-code', { code });
    return data as { user: User } & AuthTokens;
  },

  googleUrl: () =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/google`,
};
