// src/app/sounds/[slug]/page.tsx — server component with SEO metadata
import type { Metadata } from 'next';
import SoundDetailClient from './SoundDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/sounds/${params.slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Arsonus' };
    const sound = await res.json();
    const title = `${sound.title} | Arsonus`;
    const description = sound.description
      ?? `Download ${sound.title} — ${sound.category?.name} sound effect on Arsonus`;
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
    return { title: 'Arsonus' };
  }
}

export default function SoundDetailPage({ params }: { params: { slug: string } }) {
  return <SoundDetailClient slug={params.slug} />;
}
