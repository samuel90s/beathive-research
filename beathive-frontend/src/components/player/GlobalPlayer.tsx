// src/components/player/GlobalPlayer.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/lib/store/player.store';
import { useCartStore } from '@/lib/store/cart.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { useDownload } from '@/lib/hooks/useDownload';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { getPreviewStreamUrl } from '@/lib/api/sounds';
import { formatDuration } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';

// SFX: 30s preview, Music: 60s preview
function getPreviewLimit(categoryType?: string): number {
  return categoryType === 'music' ? 60 : 30;
}

function canPlayFull(accessLevel: string, userPlanSlug?: string): boolean {
  if (accessLevel === 'FREE') return true;
  if ((accessLevel === 'PRO' || accessLevel === 'BUSINESS') && userPlanSlug === 'pro') return true;
  return false;
}

export default function GlobalPlayer() {
  const {
    currentTrack, isPlaying, progress, volume,
    pause, resume, stop, setProgress, setDuration, setVolume, playNext,
  } = usePlayerStore();
  const { addItem, hasItem } = useCartStore();
  const { user } = useAuthStore();
  const { download, downloading } = useDownload();
  const { toggle: toggleWishlist, loadingId } = useWishlist();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [seeking, setSeeking] = useState(false);

  // Keyboard shortcuts: Space=play/pause, ←/→=seek 10s, M=mute
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const audio = audioRef.current;
      if (e.key === ' ' && currentTrack) { e.preventDefault(); isPlaying ? pause() : resume(); }
      if (e.key === 'ArrowLeft' && audio) { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 10); }
      if (e.key === 'ArrowRight' && audio) { e.preventDefault(); audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); }
      if ((e.key === 'm' || e.key === 'M') && audio) { e.preventDefault(); audio.muted = !audio.muted; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTrack, isPlaying, pause, resume]);
  const [liked, setLiked] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [previewLocked, setPreviewLocked] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);

  const planSlug = user?.subscription?.plan?.slug;
  const isOwner = !!(user?.id && currentTrack?.author?.id && currentTrack.author.id === user.id);
  const fullAccess = currentTrack ? (isOwner || canPlayFull(currentTrack.accessLevel, planSlug)) : false;
  const PREVIEW_LIMIT = currentTrack ? getPreviewLimit(currentTrack.category?.type) : 30;

  useEffect(() => {
    setLiked(currentTrack?.isLiked ?? false);
    setAudioError(null);
    setPreviewLocked(false);
    setCurrentSec(0);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = getPreviewStreamUrl(currentTrack.id);
    audio.load();
    if (isPlaying) audio.play().catch(() => {});
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    fetch(`${API_URL}/sounds/${currentTrack.id}/play`, { method: 'POST' }).catch(() => {});
  }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  if (!currentTrack) return null;

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || seeking) return;
    const cur = audio.currentTime;
    const dur = audio.duration || 1;
    setCurrentSec(cur);
    setTotalSec(audio.duration || 0);
    setProgress((cur / dur) * 100);
    setDuration(audio.duration || 0);

    // Enforce 30s preview for restricted sounds
    if (!fullAccess && cur >= PREVIEW_LIMIT) {
      audio.pause();
      pause();
      setPreviewLocked(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const pct = Number(e.target.value);
    const target = (pct / 100) * (audio.duration || 0);
    // Block seeking past 30s for restricted sounds
    if (!fullAccess && target >= PREVIEW_LIMIT) return;
    audio.currentTime = target;
    setProgress(pct);
  };

  const inCart = hasItem(currentTrack.id);
  const isPurchasable = currentTrack.accessLevel === 'PURCHASE' ||
    ((currentTrack.accessLevel === 'PRO' || currentTrack.accessLevel === 'BUSINESS') && currentTrack.price > 0);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const displayTotal = !fullAccess ? Math.min(totalSec || 0, PREVIEW_LIMIT) : (totalSec || 0);
  const displayProgress = !fullAccess
    ? Math.min(progress, (PREVIEW_LIMIT / (totalSec || PREVIEW_LIMIT)) * 100)
    : progress;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <style>{`
        input[type=range].player-range{-webkit-appearance:none;height:3px;background:transparent;border-radius:99px;cursor:pointer;outline:none}
        input[type=range].player-range::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#F7941D;cursor:pointer;box-shadow:0 0 8px rgba(247,148,29,0.6);transition:transform .1s}
        input[type=range].player-range:hover::-webkit-slider-thumb{transform:scale(1.2)}
        input[type=range].vol-range{-webkit-appearance:none;height:3px;background:rgba(255,255,255,0.1);border-radius:99px;cursor:pointer;outline:none}
        input[type=range].vol-range::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,0.6);cursor:pointer}
      `}</style>

      {/* Preview locked banner */}
      {previewLocked && (
        <div className="bg-gradient-to-r from-[#1a0e00]/95 to-[#0e1a18]/95 backdrop-blur-xl border-t border-accent/30 px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffaa4d" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-100">{PREVIEW_LIMIT}s preview only</p>
              <p className="text-[10px] text-accent-bright">
                {currentTrack.accessLevel === 'PURCHASE'
                  ? 'Purchase this sound to play the full version'
                  : 'Upgrade to Pro to unlock full playback'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPreviewLocked(false); audioRef.current && (audioRef.current.currentTime = 0); resume(); }}
              className="px-3 py-1 text-xs text-orange-200 hover:text-white border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
            >
              Replay
            </button>
            {currentTrack.accessLevel === 'PURCHASE' ? (
              <button
                onClick={() => { addItem(currentTrack, 'personal'); setPreviewLocked(false); }}
                className="px-3 py-1 text-xs font-medium bg-accent hover:bg-accent-dim text-white rounded-lg transition-colors"
              >
                Buy Now
              </button>
            ) : (
              <a href="/pricing"
                className="px-3 py-1 text-xs font-medium bg-accent hover:bg-accent-dim text-white rounded-lg transition-colors"
              >
                Upgrade
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main player bar */}
      <div className="bg-[#0e0f1a]/95 backdrop-blur-xl border-t border-white/[0.06] px-4 py-2.5">
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onEnded={playNext}
          onLoadedMetadata={(e) => {
            const d = (e.target as HTMLAudioElement).duration;
            setTotalSec(d);
            setDuration(d);
          }}
          onError={() => setAudioError('Failed to load audio')}
        />

        <div className="max-w-7xl mx-auto flex items-center gap-3">

          {/* Play/Pause + Stop */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={isPlaying ? pause : resume}
              disabled={previewLocked}
              className="w-9 h-9 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center transition-all shadow-[0_0_12px_rgba(247,148,29,0.4)] disabled:opacity-40 flex-shrink-0"
            >
              {isPlaying ? (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                  <rect x="1" y="1" width="4" height="10" rx="1.5"/>
                  <rect x="7" y="1" width="4" height="10" rx="1.5"/>
                </svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 12 12" fill="white">
                  <polygon points="2,1 11,6 2,11"/>
                </svg>
              )}
            </button>
            <button
              onClick={stop}
              className="hidden sm:flex w-7 h-7 rounded-full text-[#3a3c4e] hover:text-[#6b6f82] items-center justify-center transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="1" width="12" height="12" rx="2"/>
              </svg>
            </button>
          </div>

          {/* Track info */}
          <div className="flex-shrink-0 min-w-0 w-28 sm:w-40">
            <p className="text-[12px] sm:text-[13px] font-semibold text-white truncate leading-tight">{currentTrack.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-[#5a5d72] truncate">
                {currentTrack.category.name}
                {audioError
                  ? <span className="text-red-400 ml-1">· Error</span>
                  : !fullAccess ? <span className="hidden sm:inline"> · Preview {PREVIEW_LIMIT}s</span> : ''}
              </p>
              {!fullAccess && !previewLocked && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#6b6f82" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <span className="text-[10px] text-[#4a4d5e] w-8 text-right tabular-nums flex-shrink-0">
              {fmt(currentSec)}
            </span>
            <div className="flex-1 relative h-3 flex items-center group">
              {/* Track background */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-[3px] bg-white/[0.08] rounded-full" />
              </div>
              {/* Played portion */}
              <div
                className="absolute inset-y-0 left-0 flex items-center"
                style={{ width: `${displayProgress}%` }}
              >
                <div className="w-full h-[3px] bg-violet-500 rounded-full" />
              </div>
              {/* 30s marker for restricted sounds */}
              {!fullAccess && totalSec > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-violet-400/60 rounded-full"
                  style={{ left: `${Math.min((PREVIEW_LIMIT / totalSec) * 100, 100)}%` }}
                />
              )}
              <input
                type="range" min={0} max={100}
                value={Math.round(displayProgress)}
                onChange={handleSeek}
                onMouseDown={() => setSeeking(true)}
                onMouseUp={() => setSeeking(false)}
                className="player-range w-full relative z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ position: 'absolute', inset: 0, height: '100%' }}
              />
            </div>
            <span className="text-[10px] text-[#4a4d5e] w-8 tabular-nums flex-shrink-0">
              {fmt(displayTotal)}
              {!fullAccess && totalSec > PREVIEW_LIMIT && (
                <span className="text-violet-500"> /30s</span>
              )}
            </span>
          </div>

          {/* Volume */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-[#4a4d5e]">
              <path d="M2 5h2l3-3v10l-3-3H2V5z" fill="currentColor"/>
              <path d="M9 4.5c1 .8 1.5 1.5 1.5 2.5s-.5 1.7-1.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
            <div className="relative w-16 h-3 flex items-center">
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-[3px] bg-white/[0.08] rounded-full" />
              </div>
              <div className="absolute inset-y-0 left-0 flex items-center" style={{ width: `${Math.round(volume * 100)}%` }}>
                <div className="w-full h-[3px] bg-white/30 rounded-full" />
              </div>
              <input
                type="range" min={0} max={100} value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="vol-range w-full relative z-10"
              />
            </div>
          </div>

          {/* Wishlist */}
          <button
            onClick={async () => await toggleWishlist(currentTrack.id, liked, setLiked)}
            disabled={loadingId === currentTrack.id}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all ${
              liked ? 'text-rose-400' : 'text-[#3a3c4e] hover:text-rose-400'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>

          {/* Action button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner ? (
              <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-accent/10 text-accent-bright border border-accent/20">
                Your Sound
              </span>
            ) : isPurchasable && !currentTrack.isPurchased ? (
              /* Paid sound — show cart button */
              <button
                onClick={() => !inCart && addItem(currentTrack, 'personal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  inCart
                    ? 'bg-accent/20 text-accent-bright border border-accent/20'
                    : 'bg-accent text-white hover:bg-accent-dim shadow-[0_0_12px_rgba(247,148,29,0.3)]'
                }`}
              >
                {inCart ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    In Cart
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    Rp {(currentTrack.price / 1000).toFixed(0)}k
                  </>
                )}
              </button>
            ) : (
              /* Free or subscription-accessible or already purchased — show download */
              <button
                onClick={async () => {
                  try { await download(currentTrack.id, currentTrack.slug, currentTrack.format); }
                  catch (err: any) { toast.error(err.message || 'Download failed'); }
                }}
                disabled={downloading === currentTrack.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors disabled:opacity-50"
              >
                {downloading === currentTrack.id ? (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
                <span className="hidden sm:inline">
                  {downloading === currentTrack.id ? '...' : currentTrack.accessLevel === 'FREE' ? 'Download Free' : 'Download'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
