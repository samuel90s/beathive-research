'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/utils';
import SoundRow from '@/components/sounds/SoundRow';
import type { AudioAsset } from '@/types';

interface CreatorProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  soundCount: number;
  totalPlays: number;
  totalDownloads: number;
  sounds: AudioAsset[];
}

const getCreatedAtMs = (sound: AudioAsset) => (
  sound.createdAt ? new Date(sound.createdAt).getTime() : 0
);

export default function CreatorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/auth/users/${id}`)
      .then(res => setProfile(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const sounds = useMemo(() => profile?.sounds ?? [], [profile?.sounds]);
  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; count: number }>();
    for (const sound of sounds) {
      if (!sound.category) continue;
      const current = map.get(sound.category.slug) ?? { name: sound.category.name, slug: sound.category.slug, count: 0 };
      current.count += 1;
      map.set(sound.category.slug, current);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [sounds]);
  const latestSounds = useMemo(
    () => [...sounds].sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a)).slice(0, 6),
    [sounds],
  );
  const popularSounds = useMemo(
    () => [...sounds].sort((a, b) => (b.downloadCount + b.playCount) - (a.downloadCount + a.playCount)).slice(0, 6),
    [sounds],
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-full bg-white/[0.05] animate-pulse flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-16 card rounded-xl border border-rim animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-[#6b6f82] mb-3">Creator not found.</p>
        <Link href="/browse" className="text-sm text-accent-bright hover:underline">Browse sounds</Link>
      </div>
    );
  }

  const initials = profile.name?.charAt(0).toUpperCase() ?? '?';
  const joinYear = new Date(profile.createdAt).getFullYear();

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-6 py-8 pb-28">

      {/* Header */}
      <div className="card rounded-3xl border border-rim p-6 mb-6 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-teal/10 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-24 h-24 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-accent/20">
            {profile.avatarUrl
              ? <Image src={mediaUrl(profile.avatarUrl)!} alt={profile.name} width={96} height={96} className="w-full h-full object-cover" />
              : <span className="text-4xl font-bold text-accent-bright">{initials}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-white">{profile.name}</h1>
            <p className="text-sm text-[#5a5d72] mt-0.5">Creator sejak {joinYear}</p>
            {profile.bio && (
              <p className="text-sm text-[#8b8fa8] mt-2 leading-relaxed">{profile.bio}</p>
            )}
            {topCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {topCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/browse?categorySlug=${cat.slug}`}
                    className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-[#c4c6d8] hover:border-accent/30 hover:text-accent-bright transition-colors"
                  >
                    {cat.name} - {cat.count}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href={`/browse?authorId=${encodeURIComponent(profile.id)}`} className="btn-accent rounded-xl px-4 py-2.5 text-sm font-semibold">
            Lihat Semua Sound
          </Link>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-rim">
          {[
            { label: 'Sounds', value: profile.soundCount.toLocaleString() },
            { label: 'Total Plays', value: (profile.totalPlays ?? 0).toLocaleString() },
            { label: 'Downloads', value: (profile.totalDownloads ?? 0).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-[#5a5d72] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3 mb-7">
        <div className="card rounded-2xl p-5 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5a5d72] mb-3">Kategori Utama</p>
          {topCategories.length === 0 ? (
            <p className="text-sm text-[#5a5d72]">Belum ada kategori aktif.</p>
          ) : (
            <div className="space-y-3">
              {topCategories.map((cat) => (
                <div key={cat.slug} className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-teal"
                      style={{ width: `${Math.max(12, (cat.count / Math.max(1, profile.soundCount)) * 100)}%` }}
                    />
                  </div>
                  <Link href={`/browse?categorySlug=${cat.slug}`} className="w-36 truncate text-right text-sm text-[#c4c6d8] hover:text-accent-bright">
                    {cat.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5a5d72]">Rata-rata performa</p>
          <p className="mt-4 text-2xl font-bold text-white">
            {profile.soundCount ? Math.round((profile.totalPlays + profile.totalDownloads) / profile.soundCount).toLocaleString() : '0'}
          </p>
          <p className="text-sm text-[#6b6f82]">interaksi per sound</p>
        </div>
      </section>

      {profile.sounds.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#5a5d72]">
          No published sounds yet.
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-sm font-semibold text-[#4a4d5e] uppercase tracking-widest mb-3">
              Sound Terpopuler
            </h2>
            <div className="space-y-1.5">
              {popularSounds.map(sound => (
                <SoundRow key={sound.id} sound={sound} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-[#4a4d5e] uppercase tracking-widest mb-3">
              Upload Terbaru
            </h2>
            <div className="space-y-1.5">
              {latestSounds.map(sound => (
                <SoundRow key={sound.id} sound={sound} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
