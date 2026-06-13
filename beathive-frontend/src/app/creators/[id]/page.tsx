'use client';
import { useEffect, useState } from 'react';
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
    <div className="max-w-3xl mx-auto px-6 py-8 pb-28">

      {/* Header */}
      <div className="card rounded-2xl border border-rim p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-accent/20">
            {profile.avatarUrl
              ? <Image src={mediaUrl(profile.avatarUrl)!} alt={profile.name} width={80} height={80} className="w-full h-full object-cover" />
              : <span className="text-3xl font-bold text-accent-bright">{initials}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-white">{profile.name}</h1>
            <p className="text-sm text-[#5a5d72] mt-0.5">Member since {joinYear}</p>
            {profile.bio && (
              <p className="text-sm text-[#8b8fa8] mt-2 leading-relaxed">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-rim">
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

      {/* Sounds */}
      <h2 className="text-sm font-semibold text-[#4a4d5e] uppercase tracking-widest mb-3">
        Sounds by {profile.name}
      </h2>

      {profile.sounds.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#5a5d72]">
          No published sounds yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {profile.sounds.map(sound => (
            <SoundRow key={sound.id} sound={sound} />
          ))}
        </div>
      )}
    </div>
  );
}
