'use client';
// src/components/recommendations/SimilarSounds.tsx
// Grid "Similar Sounds" untuk halaman detail sound
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recommendationsApi, RecommendedSound } from '@/lib/api/recommendations';
import { usePlayerStore } from '@/lib/store/player.store';
import { useAuthStore } from '@/lib/store/auth.store';
import { formatDuration } from '@/lib/utils';

function WaveformMini({ data }: { data: number[] }) {
  return (
    <div className="flex items-center gap-[2px] h-5">
      {data.slice(0, 16).map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-gradient-to-t from-[#7c3aed]/60 to-[#06b6d4]/60"
          style={{ height: `${Math.max(20, h)}%` }}
        />
      ))}
    </div>
  );
}

interface Props {
  audioId: string;
  currentSlug: string;
  limit?: number;
}

export default function SimilarSounds({ audioId, currentSlug, limit = 3 }: Props) {
  const [sounds, setSounds] = useState<RecommendedSound[]>([]);
  const [loading, setLoading] = useState(true);
  const play = usePlayerStore((s) => s.play);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!audioId) return;
    setLoading(true);
    recommendationsApi
      .getSimilar(audioId, limit)
      .then(setSounds)
      .catch(() => setSounds([]))
      .finally(() => setLoading(false));
  }, [audioId, limit]);

  function handlePlay(sound: RecommendedSound) {
    if (isAuthenticated) {
      recommendationsApi.logBehavior('play', { audioAssetId: sound.id });
    }
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

  if (loading) {
    return (
      <div className="mt-10">
        <div className="h-5 w-36 bg-white/[0.04] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (sounds.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-white">Similar Sounds</h3>
        <span className="text-xs text-[#4a4d62]">Content-based recommendations</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sounds.map((sound) => (
          <div
            key={sound.id}
            className="group relative flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-[#13131a] hover:border-[#7c3aed]/30 hover:bg-[#17172a] transition-all"
          >
            {/* Match badge */}
            {sound.similarityScore > 0 && (
              <div className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#7c3aed]/15 text-[#a78bfa]">
                {sound.similarityScore}% Match
              </div>
            )}

            {/* Play btn */}
            <button
              onClick={() => handlePlay(sound)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-gradient-to-br hover:from-[#7c3aed] hover:to-[#06b6d4] flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/sounds/${sound.slug}`}
                className="text-sm font-medium text-[#c4c6d8] hover:text-white transition-colors line-clamp-1"
              >
                {sound.title}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <WaveformMini data={sound.waveformData} />
                <span className="text-[10px] text-[#4a4d62]">
                  {formatDuration(sound.durationMs)}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-[10px] text-[#4a4d62]">{sound.reason}</p>
            </div>

            {/* Price */}
            <span
              className={`text-[11px] font-semibold flex-shrink-0 ${
                sound.price === 0 ? 'text-[#06b6d4]' : 'text-white'
              }`}
            >
              {sound.price === 0 ? 'FREE' : `Rp ${sound.price.toLocaleString('id-ID')}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
