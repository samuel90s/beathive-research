// src/lib/api/sounds.ts
import { apiClient } from './client';
import type {
  SoundsResponse,
  AudioAsset,
  SoundFilters,
  DownloadResult,
  WishlistToggleResult,
  DownloadHistoryResponse,
} from '@/types';

/** URL backend API (tanpa trailing slash) */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Kembalikan URL stream preview untuk sebuah sound.
 *  Player menggunakan URL ini sebagai src <audio>, bukan previewUrl dari DB
 *  yang mungkin mengarah ke CDN placeholder. */
export function getPreviewStreamUrl(soundId: string): string {
  return `${API_URL}/sounds/${soundId}/preview`;
}

export const soundsApi = {
  // ─── Browse & detail ────────────────────────────────────

  getAll: async (filters: SoundFilters = {}): Promise<SoundsResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const { data } = await apiClient.get(`/sounds?${params}`);
    return data;
  },

  getOne: async (slug: string): Promise<AudioAsset> => {
    const { data } = await apiClient.get(`/sounds/${slug}`);
    return data;
  },

  // ─── Download ────────────────────────────────────────────

  requestDownload: async (id: string): Promise<DownloadResult> => {
    const { data } = await apiClient.post(`/sounds/${id}/download`);
    return data;
  },

  // ─── Wishlist ────────────────────────────────────────────

  /** Toggle like/unlike — returns { liked, message } */
  toggleWishlist: async (id: string): Promise<WishlistToggleResult> => {
    const { data } = await apiClient.post(`/sounds/${id}/wishlist`);
    return data;
  },

  /** Hapus dari wishlist secara eksplisit */
  removeWishlist: async (id: string): Promise<WishlistToggleResult> => {
    const { data } = await apiClient.delete(`/sounds/${id}/wishlist`);
    return data;
  },

  /** Daftar wishlist milik user yang login */
  getWishlist: async (
    page = 1,
    limit = 20,
  ): Promise<SoundsResponse> => {
    const { data } = await apiClient.get(
      `/sounds/wishlist?page=${page}&limit=${limit}`,
    );
    return data;
  },

  /** Related sounds berdasarkan kategori */
  getRelated: async (slug: string, limit = 6): Promise<AudioAsset[]> => {
    const { data } = await apiClient.get(`/sounds/${slug}/related?limit=${limit}`);
    return data;
  },

  /** Creator analytics */
  getCreatorAnalytics: async () => {
    const { data } = await apiClient.get('/sounds/creator/analytics');
    return data as { topSounds: any[]; monthlyDownloads: { month: string; label: string; downloads: number }[] };
  },

  /** Download history user */
  getDownloadHistory: async (params: {
    page?: number;
    limit?: number;
    licenseType?: string;
    categorySlug?: string;
    search?: string;
    source?: string;
  } = {}): Promise<DownloadHistoryResponse> => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== 'all') p.set(k, String(v));
    });
    const { data } = await apiClient.get(`/sounds/downloads/history?${p}`);
    return data;
  },
};
