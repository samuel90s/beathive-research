// src/app/sounds/[slug]/page.tsx — server component with SEO metadata
import type { Metadata } from 'next';
import SoundDetailClient from './SoundDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/sounds/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'BeatHive' };
    const sound = await res.json();
    const title = `${sound.title} | BeatHive`;
    const description = sound.description
      ?? `Download ${sound.title} — ${sound.category?.name} sound effect on BeatHive`;
    return {
      title,
      description,
      openGraph: {
        title: sound.title,
        description,
        type: 'website',
        ...(sound.previewUrl ? { audio: sound.previewUrl } : {}),
      },
      twitter: { card: 'summary', title: sound.title, description },
    };
  } catch {
    return { title: 'BeatHive' };
  }
}

export default async function SoundDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SoundDetailClient slug={slug} />;
}
