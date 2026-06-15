// src/app/wishlist/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { soundsApi } from '@/lib/api/sounds';
import { useAuthStore } from '@/lib/store/auth.store';
import type { SoundsResponse } from '@/types';
import SoundRow from '@/components/sounds/SoundRow';

export default function WishlistPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [data, setData] = useState<SoundsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  const fetchWishlist = useCallback(async (p = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await soundsApi.getWishlist(p, 20);
      setData(result);
      setPage(p);
    } catch {
      setError('Wishlist gagal dimuat. Silakan coba lagi.');
    }
    finally { setIsLoading(false); }
  }, []);

  const removeFromList = (soundId: string) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((sound) => sound.id !== soundId),
        pagination: {
          ...current.pagination,
          total: Math.max(0, current.pagination.total - 1),
        },
      };
    });
  };

  useEffect(() => {
    if (isAuthenticated) fetchWishlist(1);
  }, [isAuthenticated, fetchWishlist]);

  if (!isAuthenticated) return null;

  return (
    <div className="px-8 py-8 pb-28">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-[#5a5d72] mt-1">
          Sound yang kamu simpan
          {data && ` · ${data.pagination.total} sound`}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => fetchWishlist(page)} className="ml-2 font-semibold underline">
            Coba lagi
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-[62px] card rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-24 card rounded-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <p className="text-base font-semibold text-[#c4c6d8]">Wishlist masih kosong</p>
          <p className="text-sm text-[#5a5d72] mt-1 mb-5">Klik ikon hati pada sound untuk menyimpannya di sini</p>
          <Link href="/browse" className="inline-block px-5 py-2.5 btn-accent text-sm font-semibold rounded-xl">
            Browse Sound
          </Link>
        </div>
      )}

      {/* Sound list — uses SoundRow for consistent dark theme */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="space-y-1.5">
            {data.items.map((sound) => (
              <SoundRow
                key={sound.id}
                sound={sound}
                onWishlistChange={(liked) => {
                  if (!liked) removeFromList(sound.id);
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => fetchWishlist(page - 1)}
                className="w-9 h-9 rounded-lg border border-rim text-[#6b6f82] flex items-center justify-center hover:border-white/10 hover:text-white disabled:opacity-30 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm text-[#6b6f82] px-2">
                {page} / {data.pagination.totalPages}
              </span>
              <button
                disabled={page === data.pagination.totalPages}
                onClick={() => fetchWishlist(page + 1)}
                className="w-9 h-9 rounded-lg border border-rim text-[#6b6f82] flex items-center justify-center hover:border-white/10 hover:text-white disabled:opacity-30 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
