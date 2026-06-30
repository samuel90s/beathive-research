'use client';

import { useEffect, useMemo, useState } from 'react';
import SoundCard from '@/components/sounds/SoundCard';
import { recommendationsApi, type PersonalizedResponse, type RecommendedSound } from '@/lib/api/recommendations';
import { useAuthStore } from '@/lib/store/auth.store';
import type { AudioAsset } from '@/types';

function toAudioAsset(sound: RecommendedSound): AudioAsset {
  return {
    id: sound.id,
    title: sound.title,
    slug: sound.slug,
    previewUrl: sound.previewUrl,
    waveformData: sound.waveformData,
    durationMs: sound.durationMs,
    format: sound.format,
    price: sound.price,
    isFree: sound.price === 0,
    accessLevel: sound.accessLevel,
    licenseType: 'personal',
    playCount: sound.playCount,
    downloadCount: sound.downloadCount,
    category: { ...sound.category, icon: sound.category.icon ?? undefined },
    tags: sound.tags,
    mood: sound.mood,
    bpm: sound.bpm,
    publishedAt: '',
    similarityScore: sound.similarityScore,
    recommendationReason: sound.reason,
  };
}

function TasteProfile({ profile }: { profile: NonNullable<PersonalizedResponse['tasteProfile']> }) {
  const topSignals = useMemo(() => {
    const categories = profile.topCategories.map((item) => ({ label: item.name, score: item.score, type: 'Category' }));
    const tags = profile.topTags.map((item) => ({ label: `#${item.name}`, score: item.score, type: 'Tag' }));
    const moods = profile.topMoods.map((item) => ({ label: item.mood, score: item.score, type: 'Mood' }));
    return [...categories, ...tags, ...moods].sort((a, b) => b.score - a.score).slice(0, 8);
  }, [profile]);

  if (topSignals.length === 0) return null;

  const maxScore = Math.max(...topSignals.map((item) => item.score), 1);

  return (
    <aside className="rounded-2xl border border-rim bg-surface p-4 xl:sticky xl:top-4">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5a5d72]">Your Taste Profile</p>
        <p className="mt-1 text-xs text-[#6b6f82]">
          Built from {profile.totalInteractions} weighted interactions.
        </p>
      </div>
      <div className="space-y-3">
        {topSignals.map((item) => (
          <div key={`${item.type}-${item.label}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-[#c4c6d8] capitalize">{item.label}</span>
              <span className="text-[10px] text-[#5a5d72]">{item.type}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-teal"
                style={{ width: `${Math.max(12, Math.round((item.score / maxScore) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function BrowseRecommendations({ limit = 12 }: { limit?: number }) {
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PersonalizedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = isAuthenticated
          ? await recommendationsApi.getPersonalized(limit)
          : { items: await recommendationsApi.getTrending(limit), isColdStart: true, tasteProfile: null };
        if (!cancelled) setData(response);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, limit]);

  if (loading) {
    return (
      <div className="px-6 py-6 pb-28">
        <div className="mb-5 h-5 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-xl border border-rim bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="px-6 py-16 pb-28 text-center">
        <p className="text-base font-semibold text-[#c4c6d8]">No recommendations yet</p>
        <p className="mt-1 text-sm text-[#5a5d72]">Preview dan simpan beberapa sound dulu agar profil rasa kamu terbentuk.</p>
      </div>
    );
  }

  const sounds = data.items.map(toAudioAsset);

  return (
    <div className="px-6 py-6 pb-28">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {data.isColdStart ? 'Recommended' : 'Recommended for You'}
          </h1>
          <p className="mt-1 text-sm text-[#6b6f82]">
            {data.isColdStart
              ? 'Trending sounds while BeatHive learns your taste.'
              : 'Ranked with cosine similarity from your recent activity.'}
          </p>
        </div>
        {!data.isColdStart && (
          <span className="w-fit rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-bright">
            Personalized
          </span>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {sounds.map((sound) => (
            <SoundCard key={sound.id} sound={sound} />
          ))}
        </div>
        {data.tasteProfile && <TasteProfile profile={data.tasteProfile} />}
      </div>
    </div>
  );
}
