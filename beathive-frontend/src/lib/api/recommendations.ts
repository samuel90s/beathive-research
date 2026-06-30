// src/lib/api/recommendations.ts
import { apiClient } from './client';

export interface RecommendedSound {
  id: string;
  title: string;
  slug: string;
  previewUrl: string;
  waveformData: number[];
  durationMs: number;
  price: number;
  accessLevel: 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE';
  format: string;
  playCount: number;
  downloadCount: number;
  mood?: string | null;
  bpm?: number | null;
  category: { id: string; name: string; slug: string; icon?: string | null };
  tags: { id: string; name: string; slug: string }[];
  similarityScore: number;
  reason: string;
}

export interface TasteProfile {
  topCategories: { slug: string; name: string; score: number }[];
  topTags: { slug: string; name: string; score: number }[];
  topMoods: { mood: string; score: number }[];
  totalInteractions: number;
}

export interface PersonalizedResponse {
  items: RecommendedSound[];
  isColdStart: boolean;
  tasteProfile: TasteProfile | null;
}

export const recommendationsApi = {
  /** GET /recommendations/me — Personalized (butuh JWT) */
  getPersonalized: async (limit = 10): Promise<PersonalizedResponse> => {
    const { data } = await apiClient.get(`/recommendations/me?limit=${limit}`);
    return data;
  },

  /** GET /recommendations/similar/:audioId — Similar sounds (publik) */
  getSimilar: async (audioId: string, limit = 6): Promise<RecommendedSound[]> => {
    const { data } = await apiClient.get(
      `/recommendations/similar/${audioId}?limit=${limit}`,
    );
    return data;
  },

  /** GET /recommendations/trending — Trending sounds (publik) */
  getTrending: async (limit = 10): Promise<RecommendedSound[]> => {
    const { data } = await apiClient.get(`/recommendations/trending?limit=${limit}`);
    return data;
  },

  /** GET /recommendations/taste-profile — User taste profile */
  getTasteProfile: async (): Promise<TasteProfile> => {
    const { data } = await apiClient.get('/recommendations/taste-profile');
    return data;
  },

  /** POST /recommendations/log — Log behavior (fire & forget) */
  logBehavior: async (
    action: string,
    opts: {
      audioAssetId?: string;
      searchQuery?: string;
      categorySlug?: string;
      sessionId?: string;
    } = {},
  ): Promise<void> => {
    try {
      await apiClient.post('/recommendations/log', { action, ...opts });
    } catch {
      // Fire & forget — jangan crash kalau gagal log
    }
  },
};
