// src/types/index.ts

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  role: 'USER' | 'ADMIN';
  provider: string;
  isTwoFactorEnabled?: boolean;
  createdAt: string;
  subscription?: Subscription;
}

export interface Plan {
  id: string;
  name: string;
  slug: 'free' | 'pro';
  priceMonthly: number;
  priceYearly: number;
  downloadLimit: number;
  commercialLicense: boolean;
  unlimited: boolean;
}

export interface Subscription {
  id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodEnd: string;
  cancelledAt?: string;
  plan: Plan;
  usage?: {
    downloadsThisMonth: number;
    downloadLimit: number;
    remaining: number | null;
    unlimited: boolean;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  type?: 'sfx' | 'music';
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface Author {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
}

export interface AudioAsset {
  id: string;
  assetType?: 'SFX' | 'MUSIC';
  title: string;
  slug: string;
  description?: string;
  previewUrl: string;
  waveformData: number[];
  durationMs: number;
  fileSize?: number;
  format: string;
  price: number;
  isFree: boolean;
  isLiked?: boolean;
  isPurchased?: boolean;
  isPublished?: boolean;
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_RE_REVIEW';
  bpm?: number | null;
  mood?: string | null;
  musicalKey?: string | null;
  hasStems?: boolean;
  reviewNote?: string;
  accessLevel: 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE';
  licenseType: string;
  playCount: number;
  downloadCount: number;
  category: Category;
  tags: Tag[];
  genres?: Genre[];
  musicMetadata?: {
    bpm?: number | null;
    mood?: string | null;
    musicalKey?: string | null;
    hasStems?: boolean;
  } | null;
  sfxMetadata?: {
    subcategory?: string | null;
  } | null;
  author?: Author;
  publishedAt: string;
  createdAt?: string;
}

export interface DownloadResult {
  downloadUrl: string;
  requiresAuth: boolean;
  expiresAt: string;
  fileName: string;
}

export interface WishlistToggleResult {
  liked: boolean;
  message: string;
}

export interface Order {
  id: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  paidAt?: string;
  createdAt: string;
  items: OrderItem[];
  invoice?: Invoice;
}

export interface OrderItem {
  id: string;
  priceSnapshot: number;
  licenseType: string;
  licensePdfUrl?: string;
  audioAsset: AudioAsset;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  pdfUrl?: string;
  issuedAt: string;
}

export interface SoundsResponse {
  items: AudioAsset[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SoundFilters {
  search?: string;
  categorySlug?: string;
  authorId?: string;
  soundType?: string;
  isFree?: boolean;
  accessLevel?: 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE';
  minDuration?: number;
  maxDuration?: number;
  minPrice?: number;
  maxPrice?: number;
  priceMin?: number;
  priceMax?: number;
  licenseType?: 'personal' | 'commercial';
  tags?: string;
  minBpm?: number;
  maxBpm?: number;
  mood?: string;
  musicalKey?: string;
  hasStems?: boolean;
  genreSlug?: string;
  genres?: string;
  sortBy?: 'newest' | 'oldest' | 'popular' | 'mostplayed' | 'price_low' | 'price_high' | 'price_asc' | 'price_desc' | 'trending';
  page?: number;
  limit?: number;
}

export type LicenseType = 'personal' | 'commercial';

export interface CartItem {
  sound: AudioAsset;
  licenseType: LicenseType;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DownloadHistoryItem {
  id: string;
  soundId: string;
  soundTitle: string;
  soundSlug: string;
  soundFormat: string;
  previewUrl: string;
  categoryName: string;
  categorySlug: string;
  authorName: string | null;
  authorId: string | null;
  source: 'subscription' | 'purchase';
  licenseType: LicenseType;
  priceAtPurchase: number | null;
  downloadedAt: string;
}

export interface DownloadHistoryResponse {
  items: DownloadHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
