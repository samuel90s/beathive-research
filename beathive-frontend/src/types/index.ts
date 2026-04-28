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
  slug: 'free' | 'pro' | 'business';
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
}

export interface Tag {
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

export interface SoundEffect {
  id: string;
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
  reviewNote?: string;
  accessLevel: 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE';
  licenseType: string;
  playCount: number;
  downloadCount: number;
  category: Category;
  tags: Tag[];
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
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
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
  soundEffect: SoundEffect;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  pdfUrl?: string;
  issuedAt: string;
}

export interface SoundsResponse {
  items: SoundEffect[];
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
  soundType?: string;
  isFree?: boolean;
  accessLevel?: 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE';
  minDuration?: number;
  maxDuration?: number;
  minPrice?: number;
  maxPrice?: number;
  tags?: string;
  sortBy?: 'newest' | 'oldest' | 'popular' | 'mostplayed' | 'price_asc' | 'price_desc' | 'trending';
  page?: number;
  limit?: number;
}

export interface CartItem {
  sound: SoundEffect;
  licenseType: 'personal' | 'commercial';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
