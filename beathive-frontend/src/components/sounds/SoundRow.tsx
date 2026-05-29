// src/components/sounds/SoundRow.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePlayerStore } from '@/lib/store/player.store';
import { useCartStore } from '@/lib/store/cart.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { useDownload } from '@/lib/hooks/useDownload';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { formatDuration } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';
import type { SoundEffect } from '@/types';
import WaveformBar from './WaveformBar';
import clsx from 'clsx';

interface Props { sound: SoundEffect }

const CAT_COLORS: Record<string, string> = {
  'foley':            'from-rose-500 to-pink-600',
  'ambience':         'from-amber-400 to-orange-500',
  'soundscape':       'from-teal-500 to-cyan-600',
  'nature':           'from-green-500 to-emerald-600',
  'explosions':       'from-red-500 to-orange-600',
  'weapons':          'from-slate-600 to-zinc-700',
  'vehicles':         'from-blue-500 to-indigo-600',
  'ui-game':          'from-violet-500 to-purple-600',
  'horror':           'from-purple-900 to-indigo-950',
  'human':            'from-amber-400 to-yellow-500',
  'animals':          'from-lime-500 to-green-600',
  'electronic':       'from-cyan-500 to-blue-600',
  'comedy':           'from-yellow-400 to-amber-500',
  'magic':            'from-pink-500 to-violet-600',
  'sports':           'from-emerald-500 to-green-600',
  'industrial':       'from-stone-500 to-zinc-600',
  'sound-scoring':    'from-violet-600 to-indigo-700',
  'cinematic':        'from-indigo-600 to-blue-800',
  'electronic-music': 'from-cyan-500 to-teal-600',
  'acoustic':         'from-amber-500 to-orange-600',
};

export default function SoundRow({ sound }: Props) {
  const { currentTrack, isPlaying, play, pause } = usePlayerStore();
  const progress = usePlayerStore(s => s.progress);
  const { addItem, removeItem, hasItem } = useCartStore();
  const { user } = useAuthStore();
  const { download, downloading } = useDownload();
  const { toggle: toggleWishlist, loadingId } = useWishlist();
  const [liked, setLiked] = useState<boolean>(sound.isLiked ?? false);
  const hoverTimer = useState<ReturnType<typeof setTimeout> | null>(null);

  const isActive = currentTrack?.id === sound.id;
  const isCurrentlyPlaying = isActive && isPlaying;

  // Hover-to-preview: mulai play setelah 600ms hover
  const handleMouseEnter = () => {
    if (isActive) return;
    hoverTimer[1](setTimeout(() => play(sound), 600));
  };
  const handleMouseLeave = () => {
    if (hoverTimer[0]) { clearTimeout(hoverTimer[0]); hoverTimer[1](null); }
  };
  const inCart = hasItem(sound.id);
  const wishlistLoading = loadingId === sound.id;
  const isOwner = !!(user?.id && sound.author?.id && sound.author.id === user.id);

  const togglePlay = () => {
    if (isActive) isPlaying ? pause() : usePlayerStore.getState().resume();
    else play(sound);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inCart) removeItem(sound.id);
    else addItem(sound, 'personal');
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await download(sound.id, sound.slug, sound.format);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleWishlist(sound.id, liked, (newLiked) => setLiked(newLiked));
  };

  const accessBadge = {
    FREE:     null,
    PRO:      { label: 'PRO',      cls: 'bg-accent/15 text-accent-bright border-accent/20' },
    BUSINESS: { label: 'BUSINESS', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    PURCHASE: null,
  }[sound.accessLevel];

  return (
    <div
      onClick={togglePlay}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer group transition-all duration-150',
        isActive
          ? 'border-accent/40 bg-accent/8'
          : 'border-rim bg-surface hover:border-white/[0.12] hover:bg-lift',
      )}
      style={isActive ? { backgroundColor: 'rgba(247,148,29,0.08)' } : undefined}
    >
      {/* Category color thumbnail */}
      <div className={clsx(
        'w-9 h-9 rounded-lg flex-shrink-0 bg-gradient-to-br hidden sm:block opacity-80 group-hover:opacity-100 transition-opacity',
        CAT_COLORS[sound.category.slug] ?? 'from-slate-600 to-slate-700',
      )} />

      {/* Play button */}
      <button
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 relative',
          isActive
            ? 'bg-accent shadow-[0_0_12px_rgba(247,148,29,0.4)]'
            : 'bg-white/[0.06] group-hover:bg-accent/20',
        )}
      >
        {isCurrentlyPlaying ? (
          <svg width="9" height="9" viewBox="0 0 10 10" fill={isActive ? 'white' : '#F7941D'}>
            <rect x="1" y="0" width="3" height="10" rx="1.5"/>
            <rect x="6" y="0" width="3" height="10" rx="1.5"/>
          </svg>
        ) : (
          <svg width="9" height="11" viewBox="0 0 10 12" fill={isActive ? 'white' : '#6b6f82'}>
            <polygon points="0,0 10,6 0,12"/>
          </svg>
        )}
        {/* Lock badge for restricted sounds (not shown for owner) */}
        {sound.accessLevel !== 'FREE' && !isActive && !isOwner && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0c0d16] border border-rim flex items-center justify-center">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#6b6f82" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
        )}
      </button>

      {/* Info */}
      <div className="min-w-0 w-52 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/sounds/${sound.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-[#c4c6d8] truncate hover:text-accent-bright transition-colors"
          >
            {sound.title}
          </Link>
          {accessBadge && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${accessBadge.cls}`}>
              {accessBadge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-[#5a5d72] truncate mt-0.5">
          {sound.category.name}
          {sound.tags?.slice(0, 1).map((t) => ` · ${t.name}`)}
        </p>
        <p className="text-[10px] text-[#3a3c4e] mt-0.5 tabular-nums">
          {sound.playCount.toLocaleString()} plays · {sound.downloadCount.toLocaleString()} dl
        </p>
      </div>

      {/* Waveform */}
      <div className="flex-1 hidden sm:block">
        <WaveformBar
          data={sound.waveformData}
          isActive={isActive}
          progress={isActive ? progress : 0}
        />
      </div>

      {/* Duration */}
      <span className="text-xs text-[#5a5d72] w-10 text-right flex-shrink-0 tabular-nums">
        {formatDuration(sound.durationMs)}
      </span>

      {/* Wishlist — hidden for own sounds */}
      {!isOwner && (
        <button
          onClick={handleWishlist}
          disabled={wishlistLoading}
          title={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          className={clsx(
            'flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-150',
            liked ? 'text-rose-400' : 'text-[#3a3c4e] hover:text-rose-400',
            wishlistLoading && 'opacity-50',
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      )}

      {/* Price / Action */}
      <div className="flex items-center gap-2 flex-shrink-0 w-28 justify-end">

        {/* Owner badge — replaces all actions */}
        {isOwner ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-accent/10 text-accent-bright border border-accent/20">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            Your Sound
          </span>
        ) : (() => {
          // Purchasable: PURCHASE type, or PRO/BUSINESS with a price
          const isPurchasable = sound.accessLevel === 'PURCHASE' ||
            ((sound.accessLevel === 'PRO' || sound.accessLevel === 'BUSINESS') && sound.price > 0);

          if (isPurchasable) {
            if (sound.isPurchased) {
              return (
                <button
                  onClick={handleDownload}
                  disabled={downloading === sound.id}
                  title="Download"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-teal/20 text-teal/70 hover:bg-teal/10 hover:text-teal transition-all disabled:opacity-40"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
              );
            }
            return (
              <>
                <span className="text-xs text-[#5a5d72] font-medium">
                  Rp {(sound.price / 1000).toFixed(0)}k
                </span>
                <button
                  onClick={handleBuy}
                  title={inCart ? 'Remove from cart' : 'Add to cart'}
                  className={clsx(
                    'w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150',
                    inCart
                      ? 'bg-accent/20 text-accent-bright hover:bg-accent/30'
                      : 'bg-accent text-white hover:bg-accent-dim shadow-glow-sm',
                  )}
                >
                  {inCart ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                  )}
                </button>
              </>
            );
          }

          // Subscription-gated (PRO/BUSINESS price=0) or FREE
          return (
            <>
              {sound.accessLevel === 'FREE' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20 font-medium">Free</span>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading === sound.id}
                title="Download"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-teal/20 text-teal/70 hover:bg-teal/10 hover:text-teal hover:border-teal/40 transition-all disabled:opacity-40"
              >
                {downloading === sound.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}
