// src/app/browse/page.tsx
'use client';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSounds } from '@/lib/hooks/useSounds';
import SoundCard from '@/components/sounds/SoundCard';
import type { SoundFilters } from '@/types';
import { useDebounce } from '@/lib/hooks/useDebounce';
import clsx from 'clsx';

// ─── Category + Subcategory data ──────────────────────────────────────────────

const SFX_CATS = [
  {
    slug: 'foley', name: 'Foley', gradient: 'from-carmine to-accent',
    desc: 'Everyday objects & materials',
    subcats: ['Footsteps', 'Clothing', 'Impact', 'Paper', 'Glass', 'Wood', 'Metal', 'Liquid'],
  },
  {
    slug: 'ambience', name: 'Ambience', gradient: 'from-accent to-carmine',
    desc: 'Background atmospheres',
    subcats: ['Indoor', 'Outdoor', 'Urban', 'Underwater', 'Weather'],
  },
  {
    slug: 'soundscape', name: 'Soundscape', gradient: 'from-teal to-accent',
    desc: 'Immersive environments',
    subcats: ['Forest', 'Ocean', 'City', 'Space', 'Post-Apocalyptic'],
  },
  {
    slug: 'nature', name: 'Nature', gradient: 'from-teal to-teal-dim',
    desc: 'Outdoor & weather',
    subcats: ['Rain', 'Wind', 'Thunder', 'Fire', 'Birds', 'Insects', 'Water'],
  },
  {
    slug: 'explosions', name: 'Explosions', gradient: 'from-carmine to-accent',
    desc: 'Blasts, impacts & debris',
    subcats: ['Small', 'Large', 'Impact', 'Debris', 'Distant', 'Designed'],
  },
  {
    slug: 'weapons', name: 'Weapons', gradient: 'from-slate-600 to-zinc-700',
    desc: 'Combat & action',
    subcats: ['Guns', 'Blades', 'Bows', 'Futuristic', 'Impact', 'Reload'],
  },
  {
    slug: 'vehicles', name: 'Vehicles', gradient: 'from-teal to-carmine',
    desc: 'Cars, planes & more',
    subcats: ['Car', 'Motorcycle', 'Truck', 'Aircraft', 'Boat', 'Train'],
  },
  {
    slug: 'ui-game', name: 'UI & Game', gradient: 'from-accent to-teal',
    desc: 'Interface & game sounds',
    subcats: ['Click', 'Notification', 'Alert', 'Power-up', 'Game Over', 'Menu', 'Glitch'],
  },
  {
    slug: 'horror', name: 'Horror', gradient: 'from-carmine-dim to-carmine',
    desc: 'Scary & suspenseful',
    subcats: ['Suspense', 'Jump Scare', 'Ambient', 'Monster', 'Breathing'],
  },
  {
    slug: 'human', name: 'Human', gradient: 'from-accent to-teal',
    desc: 'Body & crowd sounds',
    subcats: ['Footsteps', 'Breathing', 'Crowd', 'Laughter', 'Voice'],
  },
  {
    slug: 'animals', name: 'Animals', gradient: 'from-teal to-accent',
    desc: 'Wildlife & pets',
    subcats: ['Dog', 'Cat', 'Bird', 'Wild', 'Insects'],
  },
  {
    slug: 'electronic', name: 'Electronic & Sci-Fi', gradient: 'from-teal to-carmine',
    desc: 'Futuristic & digital',
    subcats: ['Robot', 'Computer', 'Glitch', 'Machine', 'Sci-Fi'],
  },
  {
    slug: 'comedy', name: 'Comedy', gradient: 'from-accent to-accent-dim',
    desc: 'Cartoon & funny sounds',
    subcats: ['Cartoon', 'Boing', 'Pop', 'Slide Whistle'],
  },
  {
    slug: 'magic', name: 'Magic & Fantasy', gradient: 'from-carmine to-teal',
    desc: 'Spells & enchantments',
    subcats: ['Spell', 'Enchant', 'Fantasy', 'Mystical'],
  },
  {
    slug: 'sports', name: 'Sports', gradient: 'from-teal to-accent',
    desc: 'Athletic & action',
    subcats: ['Ball', 'Whistle', 'Crowd', 'Impact'],
  },
  {
    slug: 'industrial', name: 'Industrial', gradient: 'from-stone-500 to-zinc-600',
    desc: 'Factory & machinery',
    subcats: ['Factory', 'Machine', 'Metal', 'Construction'],
  },
];

const MUSIC_CATS = [
  {
    slug: 'sound-scoring', name: 'Sound Scoring', gradient: 'from-carmine to-accent',
    desc: 'Film & game scores',
    subcats: ['Dramatic', 'Tense', 'Emotional', 'Action'],
  },
  {
    slug: 'game-music', name: 'Game Music', gradient: 'from-accent to-teal',
    desc: 'Music for games and interactive media',
    subcats: ['8-bit', 'RPG', 'Boss Battle', 'Menu', 'Victory', 'Puzzle'],
  },
  {
    slug: 'cinematic', name: 'Cinematic', gradient: 'from-carmine-dim to-teal',
    desc: 'Epic orchestral tracks',
    subcats: ['Epic', 'Orchestral', 'Ambient', 'Trailer'],
  },
  {
    slug: 'ambient-music', name: 'Ambient Music', gradient: 'from-teal-dim to-teal',
    desc: 'Atmospheric and minimal music',
    subcats: ['Atmospheric', 'Meditation', 'Drone', 'Calm'],
  },
  {
    slug: 'electronic-music', name: 'Electronic Music', gradient: 'from-teal to-accent',
    desc: 'Electronic & beats',
    subcats: ['EDM', 'Lo-fi', 'Ambient', 'Bass', 'Synth'],
  },
  {
    slug: 'acoustic', name: 'Acoustic', gradient: 'from-accent to-carmine',
    desc: 'Organic instruments',
    subcats: ['Guitar', 'Piano', 'Folk', 'Jazz'],
  },
  {
    slug: 'corporate', name: 'Corporate', gradient: 'from-accent to-teal',
    desc: 'Business and presentation music',
    subcats: ['Inspirational', 'Technology', 'Presentation', 'Uplifting'],
  },
  {
    slug: 'lo-fi', name: 'Lo-fi', gradient: 'from-carmine-dim to-accent',
    desc: 'Relaxed beats and study music',
    subcats: ['Chill', 'Study', 'Beat', 'Relaxed'],
  },
  {
    slug: 'hip-hop', name: 'Hip-Hop', gradient: 'from-slate-600 to-accent',
    desc: 'Hip-hop beats and urban tracks',
    subcats: ['Boom Bap', 'Trap', 'Urban', 'Beat'],
  },
  {
    slug: 'rock', name: 'Rock', gradient: 'from-carmine to-zinc-700',
    desc: 'Guitars, drums, and energetic tracks',
    subcats: ['Alternative', 'Hard Rock', 'Indie', 'Punk'],
  },
  {
    slug: 'pop', name: 'Pop', gradient: 'from-accent to-carmine',
    desc: 'Modern and catchy pop music',
    subcats: ['Dance Pop', 'Indie Pop', 'Synth Pop', 'Upbeat'],
  },
  {
    slug: 'jazz', name: 'Jazz', gradient: 'from-accent-dim to-teal',
    desc: 'Jazz, swing, and lounge',
    subcats: ['Swing', 'Lounge', 'Smooth', 'Big Band'],
  },
  {
    slug: 'classical', name: 'Classical', gradient: 'from-stone-500 to-accent',
    desc: 'Classical and chamber music',
    subcats: ['Piano', 'Strings', 'Chamber', 'Romantic'],
  },
  {
    slug: 'fantasy-music', name: 'Fantasy Music', gradient: 'from-carmine to-teal',
    desc: 'Magical and fantasy worlds',
    subcats: ['Adventure', 'Medieval', 'Magic', 'RPG'],
  },
  {
    slug: 'kids-music', name: 'Kids Music', gradient: 'from-accent to-teal',
    desc: 'Playful and cheerful children music',
    subcats: ['Playful', 'Happy', 'Cartoon', 'Education'],
  },
  {
    slug: 'podcast-music', name: 'Podcast Music', gradient: 'from-teal to-slate-600',
    desc: 'Intros, outros, and podcast beds',
    subcats: ['Intro', 'Outro', 'News', 'Talk Show'],
  },
  {
    slug: 'trailer-music', name: 'Trailer Music', gradient: 'from-carmine to-accent',
    desc: 'Powerful music for trailers',
    subcats: ['Epic', 'Action', 'Teaser', 'Dramatic'],
  },
];

const FEATURED_SFX = SFX_CATS.slice(0, 8);
const FEATURED_MUSIC = MUSIC_CATS.slice(0, 8);

// ─── Category Icons (SVG paths) ───────────────────────────────────────────────

const CAT_ICONS: Record<string, React.ReactNode> = {
  'foley': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <ellipse cx="20" cy="52" rx="8" ry="4" fill="white"/>
      <path d="M20 52 L26 20 Q28 10 32 8 Q38 6 40 12 L38 26" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="40" cy="54" rx="6" ry="3" fill="white"/>
      <path d="M40 54 L44 28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="32" cy="20" r="6" stroke="white" strokeWidth="2.5"/>
      <path d="M14 30 Q20 26 26 30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  'ambience': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="32" cy="32" r="6" fill="white"/>
      <circle cx="32" cy="32" r="14" stroke="white" strokeWidth="2" strokeDasharray="4 3"/>
      <circle cx="32" cy="32" r="22" stroke="white" strokeWidth="1.5" strokeDasharray="3 4"/>
      <path d="M32 8 Q40 16 40 24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M56 32 Q48 40 40 40" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  'soundscape': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M4 48 L18 24 L28 36 L38 16 L48 30 L60 48 Z" fill="white" opacity="0.6"/>
      <path d="M4 48 L18 24 L28 36 L38 16 L48 30 L60 48" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="48" cy="14" r="5" fill="white" opacity="0.8"/>
      <path d="M4 48 H60" stroke="white" strokeWidth="1.5" opacity="0.5"/>
    </svg>
  ),
  'nature': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M32 56 L32 28" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M32 28 Q32 12 20 8 Q16 20 24 28 Q28 32 32 28Z" fill="white" opacity="0.7"/>
      <path d="M32 36 Q32 20 44 16 Q48 28 40 36 Q36 40 32 36Z" fill="white" opacity="0.7"/>
      <path d="M18 56 Q20 48 32 50 Q44 48 46 56" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  'explosions': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M32 32 L32 8 L38 20 L52 16 L44 28 L58 32 L44 36 L52 50 L38 44 L32 56 L26 44 L12 50 L20 36 L6 32 L20 28 L12 16 L26 20 Z" fill="white" opacity="0.6"/>
      <circle cx="32" cy="32" r="8" fill="white" opacity="0.8"/>
    </svg>
  ),
  'weapons': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M8 56 L44 20 L50 14 L54 10" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M50 14 L56 14 L56 20 L50 20 Z" fill="white"/>
      <path d="M8 56 L8 50 L14 50 Z" fill="white" opacity="0.7"/>
      <circle cx="54" cy="12" r="3" fill="white" opacity="0.5"/>
    </svg>
  ),
  'vehicles': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="6" y="28" width="52" height="18" rx="4" fill="white" opacity="0.5"/>
      <path d="M12 28 L18 14 L46 14 L52 28" fill="white" opacity="0.7"/>
      <circle cx="16" cy="48" r="6" fill="white"/>
      <circle cx="48" cy="48" r="6" fill="white"/>
      <rect x="32" y="18" width="10" height="8" rx="1" fill="white" opacity="0.3"/>
    </svg>
  ),
  'ui-game': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="8" y="20" width="48" height="30" rx="8" stroke="white" strokeWidth="2.5"/>
      <circle cx="22" cy="35" r="5" stroke="white" strokeWidth="2"/>
      <line x1="22" y1="30" x2="22" y2="40" stroke="white" strokeWidth="2"/>
      <line x1="17" y1="35" x2="27" y2="35" stroke="white" strokeWidth="2"/>
      <circle cx="44" cy="30" r="3" fill="white" opacity="0.8"/>
      <circle cx="50" cy="36" r="3" fill="white" opacity="0.8"/>
      <circle cx="44" cy="42" r="3" fill="white" opacity="0.8"/>
      <circle cx="38" cy="36" r="3" fill="white" opacity="0.8"/>
    </svg>
  ),
  'horror': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M32 6 Q48 6 52 20 L52 42 Q52 48 46 48 L40 48 L36 56 L32 48 L28 56 L24 48 L18 48 Q12 48 12 42 L12 20 Q16 6 32 6Z" fill="white" opacity="0.5"/>
      <circle cx="24" cy="26" r="4" fill="white"/>
      <circle cx="40" cy="26" r="4" fill="white"/>
      <path d="M22 36 Q32 44 42 36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  'human': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="32" cy="14" r="8" fill="white" opacity="0.7"/>
      <path d="M16 28 Q20 22 32 22 Q44 22 48 28 L50 48 L38 48 L36 36 L28 36 L26 48 L14 48 Z" fill="white" opacity="0.5"/>
      <path d="M16 28 L8 44" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M48 28 L56 44" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  'animals': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="24" cy="16" r="6" fill="white" opacity="0.6"/>
      <circle cx="40" cy="16" r="6" fill="white" opacity="0.6"/>
      <circle cx="16" cy="28" r="5" fill="white" opacity="0.6"/>
      <circle cx="48" cy="28" r="5" fill="white" opacity="0.6"/>
      <ellipse cx="32" cy="38" rx="14" ry="12" fill="white" opacity="0.7"/>
      <circle cx="28" cy="36" r="2" fill="white" opacity="0.4"/>
      <circle cx="36" cy="36" r="2" fill="white" opacity="0.4"/>
      <path d="M26 42 Q32 46 38 42" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  'electronic': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="14" y="14" width="36" height="36" rx="4" stroke="white" strokeWidth="2"/>
      <rect x="22" y="22" width="20" height="20" rx="2" fill="white" opacity="0.4"/>
      <line x1="14" y1="24" x2="6" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="32" x2="6" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="40" x2="6" y2="40" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="24" x2="58" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="32" x2="58" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="40" x2="58" y2="40" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="4" fill="white"/>
    </svg>
  ),
  'comedy': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="32" cy="32" r="22" stroke="white" strokeWidth="2.5"/>
      <circle cx="24" cy="26" r="3" fill="white"/>
      <circle cx="40" cy="26" r="3" fill="white"/>
      <path d="M20 38 Q26 46 32 46 Q38 46 44 38" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M28 12 L32 6 L36 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'magic': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M10 54 L40 24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M38 22 L50 10" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="50" cy="10" r="4" fill="white"/>
      <path d="M28 8 L32 14 L36 8 L32 12 Z" fill="white" opacity="0.8"/>
      <path d="M52 30 L56 36 L60 30 L56 34 Z" fill="white" opacity="0.8"/>
      <path d="M14 14 L18 20 L22 14 L18 18 Z" fill="white" opacity="0.6"/>
      <path d="M48 48 L52 54 L56 48 L52 52 Z" fill="white" opacity="0.6"/>
      <circle cx="24" cy="44" r="2" fill="white" opacity="0.5"/>
    </svg>
  ),
  'sports': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="32" cy="32" r="20" stroke="white" strokeWidth="2.5"/>
      <path d="M32 12 Q40 20 40 32 Q40 44 32 52" stroke="white" strokeWidth="2"/>
      <path d="M32 12 Q24 20 24 32 Q24 44 32 52" stroke="white" strokeWidth="2"/>
      <path d="M12 32 H52" stroke="white" strokeWidth="2"/>
      <path d="M14 22 Q24 18 40 22" stroke="white" strokeWidth="1.5"/>
      <path d="M14 42 Q24 46 40 42" stroke="white" strokeWidth="1.5"/>
    </svg>
  ),
  'industrial': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <circle cx="32" cy="32" r="16" stroke="white" strokeWidth="2.5"/>
      <circle cx="32" cy="32" r="6" fill="white" opacity="0.7"/>
      <path d="M32 10 L32 16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <path d="M32 48 L32 54" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <path d="M10 32 L16 32" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <path d="M48 32 L54 32" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <path d="M16 16 L20 20" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M44 44 L48 48" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M48 16 L44 20" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 44 L16 48" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  // Music
  'sound-scoring': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="8" y="14" width="48" height="36" rx="3" stroke="white" strokeWidth="2"/>
      <rect x="8" y="14" width="48" height="8" fill="white" opacity="0.3"/>
      <circle cx="32" cy="40" r="8" stroke="white" strokeWidth="2"/>
      <path d="M32 36 L36 40 L32 44 L28 40 Z" fill="white" opacity="0.7"/>
      <line x1="14" y1="18" x2="18" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="22" y1="18" x2="26" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'cinematic': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="8" y="18" width="40" height="28" rx="3" fill="white" opacity="0.3" stroke="white" strokeWidth="2"/>
      <path d="M48 26 L56 22 L56 42 L48 38 Z" fill="white" opacity="0.6"/>
      <rect x="14" y="24" width="12" height="8" rx="2" fill="white" opacity="0.5"/>
      <line x1="8" y1="12" x2="48" y2="12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <line x1="14" y1="12" x2="14" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="24" y1="12" x2="24" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="34" y1="12" x2="34" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  'electronic-music': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <rect x="8" y="40" width="6" height="16" rx="2" fill="white"/>
      <rect x="18" y="28" width="6" height="28" rx="2" fill="white" opacity="0.9"/>
      <rect x="28" y="14" width="6" height="42" rx="2" fill="white"/>
      <rect x="38" y="22" width="6" height="34" rx="2" fill="white" opacity="0.9"/>
      <rect x="48" y="32" width="6" height="24" rx="2" fill="white" opacity="0.8"/>
      <path d="M8 12 Q20 6 32 12 Q44 18 56 8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  'acoustic': (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full opacity-20">
      <path d="M22 48 Q10 44 10 32 Q10 20 20 16 Q26 13 32 14 L46 6" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M42 10 L50 6 L52 14 L44 18 Z" fill="white" opacity="0.6"/>
      <ellipse cx="24" cy="44" rx="12" ry="10" stroke="white" strokeWidth="2"/>
      <circle cx="24" cy="44" r="3" fill="white" opacity="0.6"/>
      <line x1="20" y1="44" x2="28" y2="44" stroke="white" strokeWidth="1.5" opacity="0.4"/>
    </svg>
  ),
};

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Terbaru' },
  { value: 'popular',    label: 'Terpopuler' },
  { value: 'trending',   label: 'Trending' },
  { value: 'mostplayed', label: 'Paling Diputar' },
];

const ACCESS_FILTERS = [
  { value: '',         label: 'Semua' },
  { value: 'FREE',     label: 'Gratis' },
  { value: 'PRO',      label: 'Pro' },
  { value: 'PURCHASE', label: 'Beli Satuan' },
];

const MUSIC_GENRES = [
  { value: '', label: 'Genre' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'orchestral', label: 'Orchestral' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'lo-fi', label: 'Lo-fi' },
  { value: 'edm', label: 'EDM' },
  { value: 'hip-hop', label: 'Hip Hop' },
  { value: 'acoustic', label: 'Acoustic' },
];

const MUSIC_MOODS = [
  { value: '', label: 'Mood' },
  { value: 'upbeat', label: 'Upbeat' },
  { value: 'calm', label: 'Calm' },
  { value: 'epic', label: 'Epic' },
  { value: 'dark', label: 'Dark' },
  { value: 'happy', label: 'Happy' },
  { value: 'tense', label: 'Tense' },
];

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, onClick }: {
  cat: { slug: string; name: string; gradient: string; desc: string; subcats: string[] };
  onClick: () => void;
}) {
  const icon = CAT_ICONS[cat.slug];
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${cat.gradient} flex flex-col justify-end p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl text-left`}
      style={{ aspectRatio: '16/10' }}
    >
      {/* Decorative background icon */}
      {icon && (
        <div className="absolute top-1/2 right-4 -translate-y-1/2 w-28 h-28 pointer-events-none">
          {icon}
        </div>
      )}

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* Hover glow */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-colors rounded-2xl" />

      {/* Text */}
      <div className="relative z-10">
        <p className="text-base font-bold text-white leading-tight">{cat.name}</p>
        <p className="text-[12px] text-white/70 mt-0.5 font-medium">{cat.desc}</p>
      </div>
    </button>
  );
}

// ─── Category Landing (no category selected) ─────────────────────────────────

function CategoryLanding({ soundType, onCategoryClick, onSubcatClick, onMoodClick }: {
  soundType: string;
  onCategoryClick: (slug: string) => void;
  onSubcatClick: (catSlug: string, subcat: string) => void;
  onMoodClick: (mood: string) => void;
}) {
  const allCats = soundType === 'music' ? MUSIC_CATS : soundType === 'sfx' ? SFX_CATS : [...SFX_CATS, ...MUSIC_CATS];

  return (
    <div className="px-6 py-6 pb-28">

      {/* Type selector */}
      <div className="flex items-center gap-1 mb-8">
        {[
          { value: '', label: 'Semua' },
          { value: 'sfx', label: 'Sound Effects' },
          { value: 'music', label: 'Music' },
        ].map(opt => (
          <button key={opt.value}
            onClick={() => opt.value === '' ? onCategoryClick('') : onSubcatClick('__type__', opt.value)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              soundType === opt.value ? 'bg-white text-black' : 'text-[#6b6f82] hover:text-white hover:bg-white/[0.06]',
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sound Effects section */}
      {soundType !== 'music' && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-[0.12em]">Sound Effects</h2>
            <div className="flex-1 h-px bg-[#1e2030]" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {FEATURED_SFX.map(cat => (
              <CategoryCard key={cat.slug} cat={cat} onClick={() => onCategoryClick(cat.slug)} />
            ))}
          </div>
        </section>
      )}

      {/* Music section */}
      {soundType !== 'sfx' && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-[0.12em]">Music</h2>
            <div className="flex-1 h-px bg-[#1e2030]" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FEATURED_MUSIC.map(cat => (
              <CategoryCard key={cat.slug} cat={cat} onClick={() => onCategoryClick(cat.slug)} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#1e2030] bg-[#0d0e18] p-4">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-[0.12em]">Mood Musik</h3>
              <div className="flex-1 h-px bg-[#1e2030]" />
            </div>
            <div className="flex flex-wrap gap-2">
              {MUSIC_MOODS.filter(m => m.value).map(mood => (
                <button
                  key={mood.value}
                  onClick={() => onMoodClick(mood.value)}
                  className="px-3 py-1.5 rounded-full border border-teal/20 bg-teal/10 text-teal text-xs font-medium capitalize hover:bg-teal/15 hover:border-teal/40 transition-colors"
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All categories + subcategories */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-[0.12em]">Semua Kategori</h2>
          <div className="flex-1 h-px bg-[#1e2030]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-px bg-[#1a1b2e] rounded-2xl overflow-hidden border border-[#1a1b2e]">
          {allCats.map(cat => (
            <div key={cat.slug} className="bg-[#0d0e18] p-4 hover:bg-[#111220] transition-colors group">
              {/* Category header */}
              <button
                onClick={() => onCategoryClick(cat.slug)}
                className="flex items-center gap-2 mb-3 w-full text-left">
                <div className={`w-3 h-3 rounded flex-shrink-0 bg-gradient-to-br ${cat.gradient}`} />
                <span className="text-[13px] font-semibold text-[#c4c6d8] group-hover:text-white transition-colors">
                  {cat.name}
                </span>
              </button>

              {/* Subcategory list */}
              <div className="space-y-1">
                {cat.subcats.map(sub => (
                  <button
                    key={sub}
                    onClick={() => onSubcatClick(cat.slug, sub)}
                    className="block text-left text-xs text-[#4a4d5e] hover:text-[#a0a3b8] transition-colors py-0.5 w-full leading-relaxed">
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Sound List (category selected) ───────────────────────────────────────────

function SoundList({ category, filters, onBack }: {
  category: { slug: string; name: string; subcats: string[] } | null;
  filters: SoundFilters;
  onBack: () => void;
}) {
  const [sort, setSort] = useState('newest');
  const [access, setAccess] = useState('');
  const [genre, setGenre] = useState(filters.genreSlug ?? '');
  const [mood, setMood] = useState(filters.mood ?? '');
  const [searchInput, setSearchInput] = useState('');
  const [subcat, setSubcat] = useState(filters.search ?? '');
  const [page, setPage] = useState(filters.page ?? 1);
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    setSubcat(filters.search ?? '');
    setSearchInput('');
    setGenre(filters.genreSlug ?? '');
    setMood(filters.mood ?? '');
    setPage(1);
  }, [filters.categorySlug, filters.genreSlug, filters.mood, filters.search, filters.soundType]);

  useEffect(() => {
    setPage(1);
  }, [sort, access, debouncedSearch, subcat, genre, mood]);

  const activeFilters: SoundFilters = useMemo(() => ({
    ...filters,
    sortBy: sort as SoundFilters['sortBy'],
    accessLevel: (access || undefined) as SoundFilters['accessLevel'],
    genreSlug: genre || undefined,
    mood: mood || undefined,
    search: debouncedSearch || (subcat ? subcat : undefined),
    page,
    limit: 30,
  }), [access, debouncedSearch, filters, genre, mood, page, sort, subcat]);

  const { data, isLoading, isFetching, isError } = useSounds(activeFilters, true);
  const isMusic = filters.soundType === 'music' || (category ? MUSIC_CATS.some(c => c.slug === category.slug) : false);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#0c0d16] border-b border-[#1a1b2e] px-6 py-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <button onClick={onBack} className="text-[#5a5d72] hover:text-white transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Browse
          </button>
          <span className="text-[#2a2c3e]">/</span>
          <span className="text-white font-medium">{category?.name ?? (filters.soundType === 'music' ? 'Music' : 'Sounds')}</span>
          {isFetching && !isLoading && <span className="text-accent-bright text-xs ml-auto">Memuat...</span>}
          {!isFetching && data && <span className="text-[#3a3c4e] text-xs ml-auto">{data.pagination.total} sounds</span>}
        </div>

        {/* Subcategory chips */}
        {category && category.subcats.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 mb-3">
            <button
              onClick={() => setSubcat('')}
              className={clsx('px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-all',
                !subcat ? 'bg-white text-black' : 'bg-white/[0.06] text-[#8b8fa8] hover:bg-white/10 hover:text-white')}>
              Semua
            </button>
            {category.subcats.map(s => (
              <button key={s}
                onClick={() => setSubcat(s === subcat ? '' : s)}
                className={clsx('px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-all',
                  subcat === s ? 'bg-white text-black' : 'bg-white/[0.06] text-[#8b8fa8] hover:bg-white/10 hover:text-white')}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 lg:max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3c4e]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari dalam kategori..."
              className="w-full pl-9 pr-3 py-1.5 input-dark rounded-lg text-sm"
            />
          </div>

          {/* Access filter */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {ACCESS_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => setAccess(f.value)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  access === f.value ? 'bg-white text-black' : 'text-[#6b6f82] hover:text-white hover:bg-white/[0.06]')}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-1.5 input-dark rounded-lg text-xs text-[#c4c6d8] cursor-pointer lg:ml-auto">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {isMusic && (
          <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <select value={genre} onChange={e => setGenre(e.target.value)} className="px-3 py-1.5 input-dark rounded-lg text-xs text-[#c4c6d8] cursor-pointer">
              {MUSIC_GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <select value={mood} onChange={e => setMood(e.target.value)} className="px-3 py-1.5 input-dark rounded-lg text-xs text-[#c4c6d8] cursor-pointer">
              {MUSIC_MOODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Sound list */}
      <div className="px-6 py-4 pb-28 flex-1">
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array(20).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl bg-[#13141f] border border-[#1e2030] animate-pulse h-40" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <p className="text-sm text-[#5a5d72]">Gagal memuat sounds. Coba lagi.</p>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="text-center py-20 card rounded-2xl">
            <p className="text-base font-semibold text-[#c4c6d8]">Belum ada sound</p>
            <p className="text-sm text-[#5a5d72] mt-1">
              {subcat ? `Tidak ada sound "${subcat}" di kategori ini` : 'Belum ada sound di kategori ini'}
            </p>
            {(subcat || searchInput || access || genre || mood) && (
              <button
                onClick={() => { setSubcat(''); setSearchInput(''); setAccess(''); setGenre(''); setMood(''); }}
                className="mt-4 px-4 py-2 rounded-lg border border-accent/30 text-xs font-medium text-accent-bright hover:bg-accent/10 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {data.items.map(sound => <SoundCard key={sound.id} sound={sound} />)}
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.pagination.page <= 1}
                  className="px-3 py-2 rounded-lg border border-rim text-xs text-[#8b8fa8] hover:text-white hover:border-white/10 disabled:opacity-40 disabled:hover:text-[#8b8fa8] disabled:hover:border-rim transition-colors"
                >
                  Prev
                </button>
                <span className="text-sm text-[#5a5d72]">
                  Halaman {data.pagination.page} dari {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  className="px-3 py-2 rounded-lg border border-rim text-xs text-[#8b8fa8] hover:text-white hover:border-white/10 disabled:opacity-40 disabled:hover:text-[#8b8fa8] disabled:hover:border-rim transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Browse ──────────────────────────────────────────────────────────────

function BrowseContent() {
  const searchParams = useSearchParams();

  const [categorySlug, setCategorySlug] = useState(searchParams.get('categorySlug') ?? '');
  const [soundType, setSoundType] = useState(searchParams.get('soundType') ?? '');
  const [urlSearch, setUrlSearch] = useState(searchParams.get('search') ?? '');
  const [urlMood, setUrlMood] = useState(searchParams.get('mood') ?? '');
  const [urlGenre, setUrlGenre] = useState(searchParams.get('genreSlug') ?? '');

  // Sync with URL
  useEffect(() => {
    const cat = searchParams.get('categorySlug') ?? '';
    const type = searchParams.get('soundType') ?? '';
    const search = searchParams.get('search') ?? '';
    const mood = searchParams.get('mood') ?? '';
    const genreSlug = searchParams.get('genreSlug') ?? '';
    setCategorySlug(cat);
    setSoundType(type);
    setUrlSearch(search);
    setUrlMood(mood);
    setUrlGenre(genreSlug);
  }, [searchParams]);

  const updateUrl = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    const query = p.toString();
    window.location.assign(query ? `/browse?${query}` : '/browse');
  };

  const handleCategoryClick = (slug: string) => {
    if (!slug) {
      updateUrl({ soundType });
    } else {
      const nextType = MUSIC_CATS.some(c => c.slug === slug) ? 'music' : 'sfx';
      updateUrl({ categorySlug: slug, soundType: nextType });
    }
  };

  const handleSubcatClick = (catSlug: string, sub: string) => {
    if (catSlug === '__type__') {
      updateUrl({ soundType: sub });
    } else {
      updateUrl({ categorySlug: catSlug, search: sub });
    }
  };

  const handleMoodClick = (mood: string) => {
    updateUrl({ soundType: 'music', mood });
  };

  const allCats = useMemo(() => [...SFX_CATS, ...MUSIC_CATS], []);
  const activeCategory = categorySlug ? allCats.find(c => c.slug === categorySlug) ?? null : null;

  const filters: SoundFilters = useMemo(() => ({
    categorySlug: categorySlug || undefined,
    soundType: soundType || undefined,
    search: urlSearch || undefined,
    mood: urlMood || undefined,
    genreSlug: urlGenre || undefined,
    sortBy: 'newest',
    page: 1,
    limit: 30,
  }), [categorySlug, soundType, urlGenre, urlMood, urlSearch]);

  if (activeCategory || (categorySlug && !activeCategory) || urlMood || urlGenre || urlSearch) {
    return (
      <SoundList
        category={activeCategory}
        filters={filters}
        onBack={() => updateUrl({ soundType })}
      />
    );
  }

  return (
    <CategoryLanding
      soundType={soundType}
      onCategoryClick={handleCategoryClick}
      onSubcatClick={handleSubcatClick}
      onMoodClick={handleMoodClick}
    />
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="px-6 py-6">
        <div className="grid grid-cols-4 gap-3 mb-8">
          {Array(8).fill(0).map((_, i) => <div key={i} className="aspect-video rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
        <div className="grid grid-cols-4 gap-px bg-[#1a1b2e] rounded-xl overflow-hidden">
          {Array(8).fill(0).map((_, i) => <div key={i} className="bg-[#0e0f1a] p-4 h-40 animate-pulse" />)}
        </div>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  );
}
