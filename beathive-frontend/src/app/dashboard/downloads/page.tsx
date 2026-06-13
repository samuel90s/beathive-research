// src/app/dashboard/downloads/page.tsx
'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { soundsApi } from '@/lib/api/sounds';
import { useDownload } from '@/lib/hooks/useDownload';
import { usePlayerStore } from '@/lib/store/player.store';
import { LicenseCertModal } from '@/components/ui/LicenseCertModal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { toast } from '@/lib/store/toast.store';
import type { DownloadHistoryItem } from '@/types';
import clsx from 'clsx';

const LICENSE_OPTIONS = [
  { value: 'all', label: 'Semua Lisensi' },
  { value: 'personal', label: 'Personal' },
  { value: 'commercial', label: 'Commercial' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'subscription', label: 'Via Subscription' },
  { value: 'purchase', label: 'Via Pembelian' },
];

const LICENSE_BADGE: Record<string, { label: string; cls: string }> = {
  personal:   { label: 'Personal',   cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  commercial: { label: 'Commercial', cls: 'bg-carmine/10 text-carmine border-carmine/20' },
};

const CAT_GRADIENT: Record<string, string> = {
  'foley': 'from-carmine to-accent',
  'ambience': 'from-accent to-carmine',
  'soundscape': 'from-teal to-accent',
  'nature': 'from-teal to-teal-dim',
  'explosions': 'from-carmine to-accent',
  'weapons': 'from-slate-600 to-zinc-700',
  'vehicles': 'from-teal to-carmine',
  'ui-game': 'from-accent to-teal',
  'horror': 'from-carmine-dim to-carmine',
  'human': 'from-accent to-teal',
  'animals': 'from-teal to-accent',
  'electronic': 'from-teal to-carmine',
  'comedy': 'from-accent to-accent-dim',
  'magic': 'from-carmine to-teal',
  'sports': 'from-teal to-accent',
  'industrial': 'from-stone-500 to-zinc-600',
  'sound-scoring': 'from-carmine to-accent',
  'cinematic': 'from-carmine-dim to-teal',
  'electronic-music': 'from-teal to-accent',
  'acoustic': 'from-accent to-carmine',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

export default function DownloadsPage() {
  const isAuth = useRequireAuth();
  const { download, downloading } = useDownload();
  const { play, currentTrack, isPlaying, pause } = usePlayerStore();

  const [page, setPage] = useState(1);
  const [licenseFilter, setLicenseFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<DownloadHistoryItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 400);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['downloadHistory', page, licenseFilter, sourceFilter, debouncedSearch],
    queryFn: () => soundsApi.getDownloadHistory({
      page,
      limit: 20,
      licenseType: licenseFilter === 'all' ? undefined : licenseFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      search: debouncedSearch || undefined,
    }),
    enabled: isAuth,
  });

  const handleDownload = useCallback(async (item: DownloadHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await download(item.soundId, item.soundSlug, item.soundFormat);
    } catch (err: any) {
      toast.error(err.message || 'Download gagal');
    }
  }, [download]);

  const handlePlay = useCallback((item: DownloadHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isActive = currentTrack?.id === item.soundId;
    if (isActive) {
      isPlaying ? pause() : usePlayerStore.getState().resume();
    } else {
      play({
        id: item.soundId,
        title: item.soundTitle,
        slug: item.soundSlug,
        previewUrl: item.previewUrl,
        format: item.soundFormat,
        durationMs: 0,
        category: { id: '', name: item.categoryName, slug: item.categorySlug },
      } as any);
    }
  }, [currentTrack, isPlaying, pause, play]);

  const resetFilters = () => {
    setLicenseFilter('all');
    setSourceFilter('all');
    setSearchInput('');
    setPage(1);
  };

  const hasFilters = licenseFilter !== 'all' || sourceFilter !== 'all' || searchInput !== '';

  return (
    <div className="px-8 py-8 pb-28">

      {/* Header + filters in one row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <h1 className="text-lg font-bold text-white flex-shrink-0">Download History</h1>

        <div className="flex items-center gap-2 flex-1 sm:justify-end flex-wrap">
          {/* Search */}
          <div className="relative min-w-[160px] max-w-[220px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3a3c4e]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Cari sound..."
              className="w-full pl-8 pr-3 py-1.5 input-dark rounded-lg text-xs"
            />
          </div>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 input-dark rounded-lg text-xs text-[#c4c6d8] cursor-pointer"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* License filter */}
          <select
            value={licenseFilter}
            onChange={(e) => { setLicenseFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 input-dark rounded-lg text-xs text-[#c4c6d8] cursor-pointer"
          >
            {LICENSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button onClick={resetFilters} className="text-[10px] text-accent-bright hover:underline">
              Reset
            </button>
          )}

          <span className="text-xs text-[#3a3c4e] tabular-nums">
            {isLoading ? '...' : `${data?.pagination.total ?? 0}`}
          </span>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-[62px] bg-surface rounded-xl border border-rim animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-16">
          <p className="text-sm font-medium text-[#8b8fa8]">Gagal memuat download history</p>
          <p className="text-xs text-[#5a5d72] mt-1">Periksa koneksi dan coba lagi</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="text-center py-20 card rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a5d72" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-[#8b8fa8]">
            {hasFilters ? 'Tidak ada hasil untuk filter ini' : 'Belum ada download'}
          </p>
          {hasFilters ? (
            <button onClick={resetFilters} className="mt-2 text-xs text-accent-bright hover:underline">
              Reset filter
            </button>
          ) : (
            <p className="text-xs text-[#5a5d72] mt-1">Download sound favoritmu dari halaman Browse</p>
          )}
        </div>
      )}

      {/* Download list */}
      {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          {data!.items.map((item) => {
            const badge = LICENSE_BADGE[item.licenseType] ?? LICENSE_BADGE.personal;
            const gradient = CAT_GRADIENT[item.categorySlug] ?? 'from-slate-600 to-slate-700';
            const isActive = currentTrack?.id === item.soundId;
            const isCurrentlyPlaying = isActive && isPlaying;

            return (
              <div
                key={item.id}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 group',
                  isActive
                    ? 'border-accent/30 bg-accent/[0.06]'
                    : 'border-rim bg-surface hover:border-white/[0.08] hover:bg-lift',
                )}
              >
                {/* Category thumbnail */}
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 bg-gradient-to-br ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />

                {/* Play button */}
                <button
                  onClick={(e) => handlePlay(item, e)}
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                    isActive
                      ? 'bg-accent shadow-[0_0_10px_rgba(139,92,246,0.4)]'
                      : 'bg-white/[0.05] hover:bg-accent/20',
                  )}
                >
                  {isCurrentlyPlaying ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill={isActive ? 'white' : '#F7941D'}>
                      <rect x="1" y="0" width="3" height="10" rx="1.5"/>
                      <rect x="6" y="0" width="3" height="10" rx="1.5"/>
                    </svg>
                  ) : (
                    <svg width="8" height="10" viewBox="0 0 10 12" fill={isActive ? 'white' : '#6b6f82'}>
                      <polygon points="0,0 10,6 0,12"/>
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#c4c6d8] truncate">{item.soundTitle}</p>
                  <p className="text-xs text-[#5a5d72] truncate mt-0.5">
                    {item.categoryName}
                    {item.authorName && ` · ${item.authorName}`}
                  </p>
                </div>

                {/* License badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex ${badge.cls}`}>
                  {badge.label}
                </span>

                {/* Source */}
                <span className="text-[11px] text-[#3a3c4e] hidden md:block whitespace-nowrap">
                  {item.source === 'subscription'
                    ? 'Subscription'
                    : item.priceAtPurchase
                      ? formatPrice(item.priceAtPurchase)
                      : 'Pembelian'}
                </span>

                {/* Date */}
                <span className="text-xs text-[#3a3c4e] hidden sm:block whitespace-nowrap w-24 text-right flex-shrink-0">
                  {fmtDate(item.downloadedAt)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => handleDownload(item, e)}
                    disabled={downloading === item.soundId}
                    title="Download ulang"
                    className="w-7 h-7 rounded-lg border border-rim text-[#6b6f82] hover:text-white hover:border-white/10 flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    {downloading === item.soundId ? (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-accent/25 bg-accent/10 text-accent-bright hover:bg-accent/15 hover:border-accent/40 transition-all whitespace-nowrap"
                  >
                    📄 Lisensi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(data?.pagination.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 rounded-lg border border-rim text-[#6b6f82] flex items-center justify-center hover:border-white/10 hover:text-white disabled:opacity-30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          {Array.from({ length: Math.min(5, data!.pagination.totalPages) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={clsx(
                  'w-9 h-9 rounded-lg text-sm font-medium transition-all',
                  page === p
                    ? 'bg-accent/15 border border-accent/30 text-accent-bright'
                    : 'border border-rim text-[#6b6f82] hover:border-white/10 hover:text-white',
                )}
              >
                {p}
              </button>
            );
          })}

          <button
            disabled={page === data?.pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 rounded-lg border border-rim text-[#6b6f82] flex items-center justify-center hover:border-white/10 hover:text-white disabled:opacity-30 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

      {/* License modal */}
      {selectedItem && (
        <LicenseCertModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
