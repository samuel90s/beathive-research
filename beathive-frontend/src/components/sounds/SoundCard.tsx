// src/components/sounds/SoundCard.tsx
'use client';
import { memo, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePlayerStore } from '@/lib/store/player.store';
import { useCartStore } from '@/lib/store/cart.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { useDownload } from '@/lib/hooks/useDownload';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { formatDuration } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';
import { recommendationsApi } from '@/lib/api/recommendations';
import type { AudioAsset } from '@/types';
import clsx from 'clsx';

interface Props { sound: AudioAsset }

const MiniWaveform = memo(function MiniWaveform({ data, isActive, progress }: { data: number[]; isActive: boolean; progress: number }) {
  const bars = useMemo(() => {
    const raw = data?.length ? data : Array(40).fill(0).map((_, i) => Math.abs(Math.sin(i * 0.5)) * 60 + 15);
    const max = Math.max(...raw, 1);
    return raw.map(v => (v as number) / max);
  }, [data]);
  const progressIdx = Math.floor((progress / 100) * bars.length);

  return (
    <div className="flex items-end gap-[1.5px] h-full w-full">
      {bars.map((h, i) => {
        const played = isActive && i < progressIdx;
        const height = Math.max(10, Math.round(h * 100));
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${height}%`,
              backgroundColor: played
                ? '#ffaa4d'
                : isActive
                ? 'var(--wave-active)'
                : 'var(--wave-muted)',
              minWidth: '1.5px',
            }}
          />
        );
      })}
    </div>
  );
});

function SoundCard({ sound }: Props) {
  const isActive = usePlayerStore(s => s.currentTrack?.id === sound.id);
  const isCurrentlyPlaying = usePlayerStore(s => s.currentTrack?.id === sound.id && s.isPlaying);
  const play = usePlayerStore(s => s.play);
  const pause = usePlayerStore(s => s.pause);
  const progress = usePlayerStore(s => s.currentTrack?.id === sound.id ? s.progress : 0);
  const { addItem, removeItem, hasItem } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { download, downloading } = useDownload();
  const { toggle: toggleWishlist, loadingId } = useWishlist();
  const [liked, setLiked] = useState(sound.isLiked ?? false);

  const inCart = hasItem(sound.id);
  const isOwner = !!(user?.id && sound.author?.id && sound.author.id === user.id);
  const isMusic = sound.assetType === 'MUSIC' || sound.category?.type === 'music';
  const musicMood = sound.mood ?? sound.musicMetadata?.mood;
  const musicGenre = sound.genres?.[0]?.name;


  const isPurchasable = sound.accessLevel === 'PURCHASE' ||
    ((sound.accessLevel === 'PRO' || sound.accessLevel === 'BUSINESS') && sound.price > 0);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      if (isCurrentlyPlaying) {
        pause();
      } else {
        usePlayerStore.getState().resume();
      }
    } else {
      if (isAuthenticated) recommendationsApi.logBehavior('play', { audioAssetId: sound.id });
      play(sound);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await download(sound.id, sound.slug, sound.format);
      if (isAuthenticated) recommendationsApi.logBehavior('download', { audioAssetId: sound.id });
    } catch (err: any) {
      toast.error(err.message || 'Download gagal');
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleWishlist(sound.id, liked, (v) => setLiked(v));
    if (isAuthenticated && !liked) recommendationsApi.logBehavior('wishlist', { audioAssetId: sound.id });
  };

  const handleCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inCart) removeItem(sound.id);
    else {
      addItem(sound, 'personal');
      if (isAuthenticated) recommendationsApi.logBehavior('cart', { audioAssetId: sound.id });
    }
  };

  return (
    <div
      onClick={() => {
        if (isAuthenticated) recommendationsApi.logBehavior('play', { audioAssetId: sound.id });
        play(sound);
      }}
      className={clsx(
        'group rounded-xl border cursor-pointer flex flex-col overflow-hidden transition-all duration-150',
        isActive
          ? 'border-accent/40 bg-accent/5 dark:bg-[#17182a]'
          : 'border-rim bg-surface hover:border-accent/25 hover:bg-lift dark:border-[#1e2030] dark:bg-[#13141f] dark:hover:border-[#2a2c3e] dark:hover:bg-[#16172a]',
      )}
    >
      {/* Waveform area */}
      <div className="relative h-20 px-3 pt-3 pb-2 flex items-end">
        <div className="absolute inset-x-3 top-3 bottom-2">
          <MiniWaveform
            data={sound.waveformData ?? []}
            isActive={isActive}
            progress={isActive ? progress : 0}
          />
        </div>

        {sound.similarityScore !== undefined && sound.similarityScore > 0 && (
          <div className="absolute left-3 top-3 z-10 rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-bright shadow-sm">
            {sound.similarityScore}% Match
          </div>
        )}

        {/* Play button */}
        <button
          onClick={togglePlay}
          aria-label={isCurrentlyPlaying ? `Pause ${sound.title}` : `Play ${sound.title}`}
          className={clsx(
            'absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md z-10',
            isActive
              ? 'bg-accent shadow-[0_0_14px_rgba(247,148,29,0.45)]'
              : 'bg-white/90 border border-rim text-slate-500 group-hover:bg-accent/15 group-hover:border-accent/30 dark:bg-[#0e0f1a]/80 dark:border-[#2a2c3e] dark:group-hover:bg-accent/20',
          )}
        >
          {isCurrentlyPlaying ? (
            <svg width="10" height="10" viewBox="0 0 12 12" fill={isActive ? 'white' : '#F7941D'}>
              <rect x="1" y="1" width="4" height="10" rx="1.5"/>
              <rect x="7" y="1" width="4" height="10" rx="1.5"/>
            </svg>
          ) : (
            <svg width="9" height="11" viewBox="0 0 10 12" fill={isActive ? 'white' : '#6b6f82'}>
              <polygon points="1,0 10,6 1,12"/>
            </svg>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="px-3 pb-3 pt-2 flex-1 flex flex-col gap-1.5 min-h-0">
        {/* Title + author */}
        <div>
          <Link
            href={`/sounds/${sound.slug}`}
            onClick={e => {
              e.stopPropagation();
              if (isAuthenticated) recommendationsApi.logBehavior('click', { audioAssetId: sound.id });
            }}
            className={clsx(
              'text-[13px] font-semibold leading-snug line-clamp-2 block transition-colors',
              isActive ? 'text-slate-900 dark:text-white' : 'text-slate-900 hover:text-accent-bright dark:text-[#c4c6d8] dark:hover:text-white',
            )}
          >
            {sound.title}
          </Link>
          {sound.author?.name && (
            <p className="text-[11px] text-slate-400 dark:text-[#4a4d5e] truncate mt-0.5">{sound.author.name}</p>
          )}
        </div>

        {/* Tags */}
        {sound.tags && sound.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sound.tags.slice(0, 3).map(t => (
              <span key={t.id ?? t.name}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-rim dark:bg-white/[0.05] dark:text-[#5a5d72] dark:border-white/[0.04]">
                {t.name}
              </span>
            ))}
            {sound.tags.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 dark:bg-white/[0.05] dark:text-[#3a3c4e]">
                +{sound.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {isMusic && (musicMood || musicGenre) && (
          <div className="flex flex-wrap gap-1">
            {musicMood && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal/10 text-teal border border-teal/20 capitalize">
                {musicMood}
              </span>
            )}
            {musicGenre && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-bright border border-accent/20">
                {musicGenre}
              </span>
            )}
          </div>
        )}

        {sound.recommendationReason && (
          <p className="line-clamp-2 border-t border-rim pt-2 text-[11px] leading-relaxed text-slate-400 dark:border-white/[0.05] dark:text-[#5a5d72]">
            {sound.recommendationReason}
          </p>
        )}

        {/* Bottom row */}
        <div className="flex items-center gap-2 mt-auto pt-0.5">
          {/* Duration */}
          <span className="text-[11px] text-slate-400 dark:text-[#4a4d5e] tabular-nums flex-shrink-0">
            {formatDuration(sound.durationMs)}
          </span>

          {/* Badge: FREE = hijau, PRO = oranye */}
          {sound.accessLevel === 'FREE' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
              Free
            </span>
          )}
          {sound.accessLevel === 'PRO' && !isPurchasable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent-bright border border-accent/20 font-medium">
              PRO
            </span>
          )}
          {isPurchasable && !sound.isPurchased && !isOwner && sound.price > 0 && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#6b6f82]">
              Rp {(sound.price / 1000).toFixed(0)}k
            </span>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {/* Wishlist */}
            {!isOwner && (
              <button
                onClick={handleWishlist}
                disabled={loadingId === sound.id}
                aria-label={liked ? `Remove ${sound.title} from wishlist` : `Add ${sound.title} to wishlist`}
                className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  liked ? 'text-rose-400' : 'text-slate-300 hover:text-rose-400 dark:text-[#3a3c4e]',
                )}
                title={liked ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24"
                  fill={liked ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            )}

            {/* Action: owner badge | cart | download */}
            {isOwner ? (
              <span className="text-[10px] text-accent-bright px-2 py-1 rounded bg-accent/10 border border-accent/20 font-medium">
                Mine
              </span>
            ) : isPurchasable && !sound.isPurchased ? (
              <button
                onClick={handleCart}
                aria-label={inCart ? `Remove ${sound.title} from cart` : `Add ${sound.title} to cart`}
                className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  inCart
                    ? 'bg-accent/20 text-accent-bright border border-accent/20'
                    : 'bg-accent text-white hover:bg-accent-dim',
                )}
                title={inCart ? 'Remove from cart' : 'Add to cart'}
              >
                {inCart ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                )}
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={downloading === sound.id}
                aria-label={`Download ${sound.title}`}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-rim text-slate-400 hover:text-teal hover:border-teal/30 transition-all disabled:opacity-40 dark:bg-[#1a1b2e] dark:border-[#2a2c3e] dark:text-[#6b6f82] dark:hover:text-white dark:hover:border-white/10"
                title="Download"
              >
                {downloading === sound.id ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SoundCard);
