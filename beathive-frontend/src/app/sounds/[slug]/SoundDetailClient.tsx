// src/app/sounds/[slug]/SoundDetailClient.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { soundsApi } from '@/lib/api/sounds';
import { ordersApi } from '@/lib/api/orders';
import { usePlayerStore } from '@/lib/store/player.store';
import { useCartStore } from '@/lib/store/cart.store';
import { useDownload } from '@/lib/hooks/useDownload';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { useAuthStore } from '@/lib/store/auth.store';
import { formatDuration, mediaUrl } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';
import WaveformBar from '@/components/sounds/WaveformBar';
import RatingSection from '@/components/sounds/RatingSection';
import SoundRow from '@/components/sounds/SoundRow';
import type { AudioAsset } from '@/types';

export default function SoundDetailClient({ slug }: { slug: string }) {
  const router = useRouter();

  const [sound, setSound] = useState<AudioAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [buyNowOpen, setBuyNowOpen] = useState(false);
  const [relatedSounds, setRelatedSounds] = useState<AudioAsset[]>([]);

  const { currentTrack, isPlaying, play, pause } = usePlayerStore();
  const progress = usePlayerStore(s => s.progress);
  const { addItem, removeItem, hasItem } = useCartStore();
  const { download, downloading } = useDownload();
  const { toggle: toggleWishlist, loadingId } = useWishlist();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    soundsApi.getOne(slug)
      .then((s) => {
        if (controller.signal.aborted) return;
        setSound(s);
        setLiked(s.isLiked ?? false);
        soundsApi.getRelated(slug).then(setRelatedSounds).catch(() => {});
      })
      .catch(() => { if (!controller.signal.aborted) setError('Sound not found'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);

  if (loading) {
    return (
      <div className="px-8 pt-12 flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !sound) {
    return (
      <div className="px-8 pt-12 text-center">
        <p className="text-[#6b6f82]">{error || 'Sound not found'}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              soundsApi.getOne(slug)
                .then(s => { setSound(s); setLiked(s.isLiked ?? false); })
                .catch(() => setError('Sound not found'))
                .finally(() => setLoading(false));
            }}
            className="text-accent-bright text-sm hover:underline"
          >
            Try again
          </button>
          <span className="text-[#3a3c4e]">·</span>
          <Link href="/browse" className="text-[#6b6f82] text-sm hover:underline">Back to Browse</Link>
        </div>
      </div>
    );
  }

  const isActive = currentTrack?.id === sound.id;
  const isCurrentlyPlaying = isActive && isPlaying;
  const inCart = hasItem(sound.id);
  const wishlistLoading = loadingId === sound.id;

  const togglePlay = () => {
    if (isActive) {
      isPlaying ? pause() : usePlayerStore.getState().resume();
    } else {
      play(sound);
    }
  };

  const handleDownload = async () => {
    try {
      await download(sound.id, sound.slug, sound.format);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    await toggleWishlist(sound.id, liked, (newLiked) => setLiked(newLiked));
  };

  const accessLabels = {
    FREE:     { label: 'Free',     cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
    PRO:      { label: 'Pro',      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    BUSINESS: { label: 'Business', cls: 'bg-carmine/10 text-carmine border-carmine/20' },
    PURCHASE: { label: 'Beli',     cls: 'bg-white/[0.05] text-[#c4c6d8] border-rim' },
  };
  const badge = accessLabels[sound.accessLevel] ?? accessLabels.FREE;

  const planSlug = user?.subscription?.plan?.slug;
  const isSubActive = user?.subscription?.status === 'ACTIVE';
  const canReview = isAuthenticated && (
    sound.isPurchased ||
    sound.accessLevel === 'FREE' ||
    ((sound.accessLevel === 'PRO' || sound.accessLevel === 'BUSINESS') && isSubActive && planSlug === 'pro')
  );
  const isMusic = sound.assetType === 'MUSIC' || sound.category?.type === 'music';
  const musicBpm = sound.bpm ?? sound.musicMetadata?.bpm;
  const musicMood = sound.mood ?? sound.musicMetadata?.mood;
  const musicKey = sound.musicalKey ?? sound.musicMetadata?.musicalKey;
  const hasStems = sound.hasStems ?? sound.musicMetadata?.hasStems;
  const musicGenres = sound.genres ?? [];

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="px-6 sm:px-8 py-6 sm:py-8 pb-28">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#6b6f82] mb-6">
        <Link href="/browse" className="hover:text-accent-bright transition-colors">Browse</Link>
        <span>/</span>
        <Link href={`/browse?categorySlug=${sound.category.slug}`} className="hover:text-accent-bright transition-colors">
          {sound.category.name}
        </Link>
        <span>/</span>
        <span className="text-[#8b8fa8] truncate">{sound.title}</span>
      </nav>

      {/* 2-column layout */}
      <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 space-y-4">
      {/* Main card */}
      <div className="card rounded-2xl border border-rim p-6">
        {/* Title */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-semibold text-white">{sound.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          {sound.author && (
            <p className="text-sm text-[#5a5d72]">
              by <span className="text-[#8b8fa8] font-medium">{sound.author.name}</span>
            </p>
          )}
        </div>

        {/* Player */}
        <div
          onClick={togglePlay}
          className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer mb-5 transition-colors ${
            isActive ? 'bg-accent/10 border border-accent/30' : 'bg-white/[0.03] border border-rim hover:border-accent/20'
          }`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              isActive ? 'bg-accent' : 'bg-white/[0.06] hover:bg-accent/20'
            }`}
          >
            {isCurrentlyPlaying ? (
              <svg width="12" height="12" viewBox="0 0 10 10" fill={isActive ? 'white' : '#F7941D'}>
                <rect x="1" y="0" width="3" height="10" rx="1"/>
                <rect x="6" y="0" width="3" height="10" rx="1"/>
              </svg>
            ) : (
              <svg width="12" height="14" viewBox="0 0 10 12" fill={isActive ? 'white' : '#9ca3af'}>
                <polygon points="0,0 10,6 0,12"/>
              </svg>
            )}
          </button>
          <div className="flex-1">
            <WaveformBar
              data={sound.waveformData}
              isActive={isActive}
              progress={isActive ? progress : 0}
            />
          </div>
          <span className="text-sm text-[#6b6f82] tabular-nums flex-shrink-0">
            {formatDuration(sound.durationMs)}
          </span>
        </div>

        {/* Description */}
        {sound.description && (
          <p className="text-sm text-[#8b8fa8] mb-5 leading-relaxed">{sound.description}</p>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 text-center">
          {[
            { label: 'Format', value: sound.format.toUpperCase() },
            { label: 'Duration', value: formatDuration(sound.durationMs) },
            { label: 'Plays', value: sound.playCount.toLocaleString() + 'x' },
            { label: 'Downloads', value: sound.downloadCount.toLocaleString() + 'x' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] rounded-xl p-3">
              <p className="text-xs text-[#6b6f82] mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-[#c4c6d8]">{value}</p>
            </div>
          ))}
        </div>

        {/* Tags */}
        {sound.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {sound.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/browse?search=${tag.slug}`}
                className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-[#8b8fa8] hover:bg-accent/[0.12] hover:text-accent-bright transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Music metadata */}
        {isMusic && (musicBpm || musicMood || musicKey || hasStems || musicGenres.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {musicMood && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/20 font-medium capitalize">
                Mood: {musicMood}
              </span>
            )}
            {musicGenres.slice(0, 3).map((genre) => (
              <span key={genre.id ?? genre.slug} className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent-bright border border-accent/20 font-medium">
                Genre: {genre.name}
              </span>
            ))}
            {musicBpm && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-[#c4c6d8] border border-white/[0.08] font-medium">
                BPM: {musicBpm}
              </span>
            )}
            {musicKey && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-[#c4c6d8] border border-white/[0.08] font-medium">
                Key: {musicKey}
              </span>
            )}
            {hasStems && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                Stems Included
              </span>
            )}
          </div>
        )}
        {/* File size */}
        {sound.fileSize && (
          <p className="text-xs text-[#6b6f82] mb-4">File size: {formatFileSize(sound.fileSize)}</p>
        )}

        {/* Mobile CTA */}
        <div className="lg:hidden">
          <DownloadCTA
            sound={sound}
            user={user}
            inCart={inCart}
            isAuthenticated={isAuthenticated}
            downloading={downloading}
            onDownload={handleDownload}
            onAddCart={() => addItem(sound, 'personal')}
            onRemoveCart={() => removeItem(sound.id)}
            onLogin={() => router.push('/auth/login')}
            onBuyNow={() => {
              if (!isAuthenticated) { router.push('/auth/login'); return; }
              setBuyNowOpen(true);
            }}
          />
        </div>

      </div>

      {/* Ratings & Reviews */}
      <RatingSection soundId={sound.id} canReview={canReview} />

      {/* Related Sounds */}
      {relatedSounds.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#4a4d5e] uppercase tracking-widest mb-3">Sound Serupa</h3>
          <div className="space-y-1.5">
            {relatedSounds.map(s => <SoundRow key={s.id} sound={s} />)}
          </div>
        </div>
      )}

      </div>{/* end left column */}

      {/* Right column — sticky */}
      <div className="w-72 xl:w-80 flex-shrink-0 hidden lg:flex flex-col gap-4 sticky top-4">

        {/* CTA card */}
        <div className="card rounded-2xl border border-rim p-5">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <h2 className="text-base font-semibold text-white">{sound.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <DownloadCTA
            sound={sound}
            user={user}
            inCart={inCart}
            isAuthenticated={isAuthenticated}
            downloading={downloading}
            onDownload={handleDownload}
            onAddCart={() => addItem(sound, 'personal')}
            onRemoveCart={() => removeItem(sound.id)}
            onLogin={() => router.push('/auth/login')}
            onBuyNow={() => {
              if (!isAuthenticated) { router.push('/auth/login'); return; }
              setBuyNowOpen(true);
            }}
          />
        </div>

        {/* Creator card */}
        {sound.author && (
          <Link href={`/creators/${sound.author.id}`}
            className="card rounded-2xl border border-rim p-4 flex items-center gap-3 hover:border-accent/30 hover:bg-accent/[0.04] transition-colors group block">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 text-accent-bright font-semibold text-sm overflow-hidden">
              {sound.author.avatarUrl
                ? <Image src={mediaUrl(sound.author.avatarUrl)!} alt={sound.author.name} width={40} height={40} className="w-full h-full object-cover" />
                : sound.author.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#3a3c4e] uppercase tracking-wide mb-0.5">Creator</p>
              <p className="text-sm font-medium text-[#c4c6d8] group-hover:text-accent-bright transition-colors truncate">{sound.author.name}</p>
            </div>
            <svg className="w-4 h-4 text-[#3a3c4e] group-hover:text-accent-bright transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        )}

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          disabled={wishlistLoading}
          className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            liked
              ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/15'
              : 'border-rim text-[#6b6f82] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/[0.06]'
          } ${wishlistLoading ? 'opacity-50' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {liked ? 'Hapus dari Wishlist' : 'Simpan ke Wishlist'}
        </button>
      </div>

      </div>{/* end 2-column layout */}

      {/* Buy Now modal */}
      {buyNowOpen && sound && (
        <BuyNowModal
          sound={sound}
          onClose={() => setBuyNowOpen(false)}
          onPaid={(orderId) => router.push(`/orders/${orderId}/success`)}
        />
      )}
    </div>
  );
}

// ─── CTA component ────────────────────────────────────────

interface CTAProps {
  sound: AudioAsset;
  user: import('@/types').User | null;
  inCart: boolean;
  isAuthenticated: boolean;
  downloading: string | null;
  onDownload: () => void;
  onAddCart: () => void;
  onRemoveCart: () => void;
  onLogin: () => void;
  onBuyNow: () => void;
}

function DownloadCTA({ sound, user, inCart, isAuthenticated, downloading, onDownload, onAddCart, onRemoveCart, onLogin, onBuyNow }: CTAProps) {
  const planSlug = user?.subscription?.plan.slug;
  const isSubActive = user?.subscription?.status === 'ACTIVE';
  const hasProAccess = isSubActive && planSlug === 'pro';

  const isPurchasable = sound.accessLevel === 'PURCHASE' ||
    ((sound.accessLevel === 'PRO' || sound.accessLevel === 'BUSINESS') && sound.price > 0);

  const DownloadBtn = ({ label = 'Download' }: { label?: string }) => (
    <button
      onClick={isAuthenticated ? onDownload : onLogin}
      disabled={downloading === sound.id}
      className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {downloading === sound.id ? (
        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Downloading...</>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );

  if (sound.accessLevel === 'FREE') {
    return <div className="flex gap-3"><DownloadBtn label="Download Free" /></div>;
  }

  if (isPurchasable) {
    if (sound.isPurchased) {
      return <div className="flex gap-3"><DownloadBtn label="Download (Purchased)" /></div>;
    }
    const priceK = `Rp ${(sound.price / 1000).toFixed(0)}k`;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-center px-2 flex-shrink-0">
          <p className="text-lg font-bold text-white">{priceK}</p>
          <p className="text-xs text-[#6b6f82]">{sound.licenseType}</p>
        </div>
        <button
          onClick={inCart ? onRemoveCart : onAddCart}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
            inCart
              ? 'border-accent/30 text-accent-bright bg-accent/5 hover:bg-accent/10'
              : 'border-rim text-[#c4c6d8] hover:border-accent/30 hover:text-accent-bright'
          }`}
        >
          {inCart ? 'Remove from Cart' : 'Add to Cart'}
        </button>
        <button
          onClick={onBuyNow}
          className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Buy Now
        </button>
      </div>
    );
  }

  if (sound.accessLevel === 'PRO') {
    if (hasProAccess) {
      return <div className="flex gap-3"><DownloadBtn label="Download (PRO)" /></div>;
    }
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-400">Pro Plan Required</p>
          <p className="text-xs text-[#6b6f82] mt-0.5">Upgrade to download this sound</p>
        </div>
        <Link href="/pricing" className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors flex-shrink-0">
          Upgrade
        </Link>
      </div>
    );
  }

  if (sound.accessLevel === 'BUSINESS') {
    // Treat BUSINESS sounds same as PRO since Business plan is removed
    if (hasProAccess) {
      return <div className="flex gap-3"><DownloadBtn label="Download" /></div>;
    }
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-400">Pro Plan Required</p>
          <p className="text-xs text-[#6b6f82] mt-0.5">Upgrade to download this sound</p>
        </div>
        <Link href="/pricing" className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors flex-shrink-0">
          Upgrade
        </Link>
      </div>
    );
  }

  return null;
}

// ─── Buy Now modal ─────────────────────────────────────────

function BuyNowModal({ sound, onClose, onPaid }: {
  sound: AudioAsset;
  onClose: () => void;
  onPaid: (orderId: string) => void;
}) {
  const [license, setLicense] = useState<'personal' | 'commercial'>('personal');
  const [loading, setLoading] = useState(false);

  const SERVICE_FEE_PERCENT = 5;
  const TAX_PERCENT = 11;

  const personalPrice = sound.price;
  const commercialPrice = sound.price * 2;
  const subtotal = license === 'personal' ? personalPrice : commercialPrice;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_PERCENT / 100);
  const tax = Math.round((subtotal + serviceFee) * TAX_PERCENT / 100);
  const grandTotal = subtotal + serviceFee + tax;

  const fmtPrice = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const pay = async () => {
    setLoading(true);
    try {
      const result = await ordersApi.create([{ sound, licenseType: license }]);
      const snap = (window as any).snap;
      if (!snap) {
        toast.error('Payment system not ready, please try again');
        setLoading(false);
        return;
      }
      snap.pay(result.snapToken, {
        onSuccess: async () => {
          try { await ordersApi.verifyPayment(result.orderId); } catch { /* webhook may have fired */ }
          onClose();
          onPaid(result.orderId);
        },
        onPending: () => { onClose(); onPaid(result.orderId); },
        onError: () => { toast.error('Payment failed, please try again'); setLoading(false); },
        onClose: () => { setLoading(false); },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order');
      setLoading(false);
    }
  };

  const licenses = [
    { type: 'personal' as const,   label: 'Personal License',   price: personalPrice,   desc: 'Proyek personal, podcast, konten non-komersial' },
    { type: 'commercial' as const, label: 'Commercial License', price: commercialPrice, desc: 'Iklan, film, konten monetized, apps & games' },
  ];

  const breakdown = [
    { label: 'Subtotal',                                value: fmtPrice(subtotal) },
    { label: `Biaya Layanan (${SERVICE_FEE_PERCENT}%)`, value: fmtPrice(serviceFee) },
    { label: `PPN (${TAX_PERCENT}%)`,                   value: fmtPrice(tax) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card rounded-2xl border border-rim w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Buy Now</h2>
            <p className="text-xs text-[#6b6f82] truncate max-w-[240px] mt-0.5">{sound.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#5a5d72] hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {licenses.map(({ type, label, price: p, desc }) => {
            const sel = license === type;
            return (
              <button
                key={type}
                onClick={() => setLicense(type)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  sel ? 'border-accent/50 bg-accent/5' : 'border-rim hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{label}</span>
                  <span className="text-sm font-bold text-white">Rp {(p / 1000).toFixed(0)}k</span>
                </div>
                <p className="text-xs text-[#6b6f82] leading-relaxed">{desc}</p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-rim pt-3 mb-4 space-y-1.5">
          {breakdown.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-[#6b6f82]">{label}</span>
              <span className="text-[#8b8fa8]">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-rim">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="text-lg font-bold text-white">{fmtPrice(grandTotal)}</span>
          </div>
        </div>

        <button
          onClick={pay}
          disabled={loading}
          className="w-full py-3 btn-accent rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Pay {fmtPrice(grandTotal)}
            </>
          )}
        </button>
        <p className="text-center text-[10px] text-[#4a4d5e] mt-3">
          Secure payment via Midtrans · QRIS, Bank Transfer, Credit Card
        </p>
      </div>
    </div>
  );
}
