'use client';
// src/components/recommendations/RecommendedSection.tsx
// Section "Recommended for You" / "Trending Now" untuk homepage & browse page
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { recommendationsApi, RecommendedSound } from '@/lib/api/recommendations';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePlayerStore } from '@/lib/store/player.store';
import { formatDuration } from '@/lib/utils';

function WaveformMini({ data }: { data: number[] }) {
  const bars = data.slice(0, 20);
  return (
    <div className="flex items-center gap-[2px] h-6 shrink-0">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-gradient-to-t from-[#7c3aed] to-[#06b6d4]"
          style={{ height: `${Math.max(15, h)}%` }}
        />
      ))}
    </div>
  );
}

function SoundCard({ sound, onPlay }: { sound: RecommendedSound; onPlay: (s: RecommendedSound) => void }) {
  const isMatch = sound.similarityScore > 0;

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.06] bg-[#13131a] hover:border-[#7c3aed]/40 hover:bg-[#17172a] transition-all duration-200 min-w-[220px] max-w-[260px]">
      {/* Match badge */}
      {isMatch && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30">
          {sound.similarityScore}% Match
        </div>
      )}

      {/* Waveform + Play button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onPlay(sound)}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform shadow-lg shadow-[#7c3aed]/30"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <WaveformMini data={sound.waveformData} />
      </div>

      {/* Title + category */}
      <div>
        <Link
          href={`/sounds/${sound.slug}`}
          className="text-sm font-medium text-white hover:text-[#a78bfa] transition-colors line-clamp-1"
        >
          {sound.title}
        </Link>
        <p className="text-xs text-[#5a5d72] mt-0.5">{sound.category.name}</p>
      </div>

      {/* Tags */}
      {sound.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sound.tags.slice(0, 3).map((t) => (
            <span key={t.id} className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-[#6b6f82]">
              #{t.name}
            </span>
          ))}
        </div>
      )}

      {/* Duration + price */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[11px] text-[#4a4d62]">
          {formatDuration(sound.durationMs)}
        </span>
        <span
          className={`text-[11px] font-semibold ${
            sound.price === 0 ? 'text-[#06b6d4]' : 'text-white'
          }`}
        >
          {sound.price === 0 ? 'FREE' : `Rp ${sound.price.toLocaleString('id-ID')}`}
        </span>
      </div>

      {/* Reason */}
      <p className="text-[10px] text-[#3a3d52] italic border-t border-white/[0.04] pt-2">
        {sound.reason}
      </p>
    </div>
  );
}

interface Props {
  title?: string;
  subtitle?: string;
  mode?: 'personalized' | 'trending';
  limit?: number;
}

export default function RecommendedSection({
  title,
  subtitle,
  mode = 'personalized',
  limit = 10,
}: Props) {
  const [sounds, setSounds] = useState<RecommendedSound[]>([]);
  const [isColdStart, setIsColdStart] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const play = usePlayerStore((s) => s.play);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (mode === 'personalized' && isAuthenticated) {
          const res = await recommendationsApi.getPersonalized(limit);
          setSounds(res.items);
          setIsColdStart(res.isColdStart);
        } else {
          const res = await recommendationsApi.getTrending(limit);
          setSounds(res);
          setIsColdStart(true);
        }
      } catch {
        setSounds([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mode, isAuthenticated, limit]);

  function handlePlay(sound: RecommendedSound) {
    // Log play behavior
    if (isAuthenticated) {
      recommendationsApi.logBehavior('play', { audioAssetId: sound.id });
    }
    // Trigger global player
    play({
      id: sound.id,
      title: sound.title,
      slug: sound.slug,
      previewUrl: sound.previewUrl,
      waveformData: sound.waveformData,
      durationMs: sound.durationMs,
      price: sound.price,
      isFree: sound.price === 0,
      isLiked: false,
      isPurchased: false,
      accessLevel: sound.accessLevel,
      format: sound.format,
      playCount: sound.playCount,
      downloadCount: sound.downloadCount,
      category: sound.category,
      tags: sound.tags,
      licenseType: 'personal',
      publishedAt: '',
    } as any);
  }

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  }

  function scrollRight() {
    scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' });
  }

  if (loading) {
    return (
      <section className="max-w-5xl mx-auto px-4 mb-12">
        <div className="h-5 w-48 bg-white/[0.04] rounded-lg mb-4 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="min-w-[220px] h-44 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (sounds.length === 0) return null;

  const displayTitle =
    title ?? (isColdStart ? 'Trending Now' : 'Recommended for You');
  const displaySubtitle =
    subtitle ??
    (isColdStart
      ? 'Most downloaded sounds right now'
      : 'Based on your listening history');

  return (
    <section className="max-w-5xl mx-auto px-4 mb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{displayTitle}</h2>
            {!isColdStart && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30">
                ✨ For You
              </span>
            )}
          </div>
          <p className="text-xs text-[#5a5d72] mt-0.5">{displaySubtitle}</p>
        </div>
        {/* Scroll controls */}
        <div className="flex gap-2">
          <button
            onClick={scrollLeft}
            className="w-8 h-8 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={scrollRight}
            className="w-8 h-8 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x"
        style={{ scrollbarWidth: 'none' }}
      >
        {sounds.map((sound) => (
          <div key={sound.id} className="snap-start shrink-0">
            <SoundCard sound={sound} onPlay={handlePlay} />
          </div>
        ))}
      </div>
    </section>
  );
}
