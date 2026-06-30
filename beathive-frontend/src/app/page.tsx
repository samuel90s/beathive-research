import Link from 'next/link';
import RecommendedSection from '@/components/recommendations/RecommendedSection';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  _count: { audioAssets: number };
}

async function getCategories(): Promise<Category[]> {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  try {
    const res = await fetch(`${api}/sounds/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.items ?? [];
  } catch {
    return [];
  }
}

// Animated waveform graphic for hero
function HeroWaveform() {
  const bars = [30, 55, 80, 45, 95, 60, 70, 40, 85, 50, 75, 35, 90, 55, 65, 45, 80, 30, 70, 60, 50, 85, 40, 75, 95, 45, 65, 55, 80, 35];
  return (
    <div className="flex items-center justify-center gap-[3px] h-16 opacity-40 select-none pointer-events-none">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-accent to-teal"
          style={{
            height: `${h}%`,
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}

// Floating sound orbs
function GlowOrb({ className }: { className: string }) {
  return (
    <div className={`absolute rounded-full blur-[80px] pointer-events-none ${className}`} />
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </svg>
    ),
    title: 'Preview Before You Buy',
    desc: 'Listen to a 30-second high-quality preview of every sound before adding to cart.',
    color: 'text-accent-bright',
    bg: 'bg-accent/10',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Royalty-Free License',
    desc: 'Every purchase includes a legally-valid license document, personal or commercial.',
    color: 'text-teal',
    bg: 'bg-teal/10',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: 'Instant Download',
    desc: 'Files ready immediately after payment. High-res WAV, MP3, and more formats.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
];

export default async function HomePage() {
  const categories = await getCategories();
  const totalSounds = categories.reduce((total, category) => total + category._count.audioAssets, 0);
  const activeCategories = categories.filter((category) => category._count.audioAssets > 0).length;
  const stats = [
    { value: totalSounds.toLocaleString('id-ID'), label: 'Sounds' },
    { value: activeCategories.toLocaleString('id-ID'), label: 'Active Categories' },
    { value: '3/day', label: 'Free Downloads' },
    { value: '2', label: 'License Types' },
  ];

  return (
    <div className="relative overflow-hidden">

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center text-center px-4 py-20">

        {/* Background effects */}
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-[0.4] pointer-events-none" />
        <GlowOrb className="w-96 h-96 bg-accent/20 -top-20 -left-20" />
        <GlowOrb className="w-72 h-72 bg-teal/15 top-1/3 -right-10" />

        {/* Badge */}
        <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/10 text-accent-bright text-xs font-medium mb-8 animate-fade-up">
          <span className="w-1.5 h-1.5 bg-teal rounded-full animate-pulse" />
          {totalSounds.toLocaleString('id-ID')} ready-to-use sounds
        </div>

        {/* Heading */}
        <h1 className="relative text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6 animate-fade-up max-w-3xl">
          <span className="text-white">The sound library</span>
          <br />
          <span className="text-gradient">creators trust</span>
        </h1>

        <p className="relative text-lg text-[#7d7f96] max-w-lg mx-auto mb-4 animate-fade-up leading-relaxed">
          Premium SFX and music for video, games, podcasts, and ads. Subscribe for broader access or buy individually.
        </p>

        {/* Waveform graphic */}
        <div className="relative w-full max-w-md mx-auto mb-8">
          <HeroWaveform />
        </div>

        {/* CTA buttons */}
        <div className="relative flex items-center justify-center gap-3 flex-wrap animate-fade-up">
          <Link href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 btn-accent rounded-xl text-sm font-semibold shadow-glow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            Browse Sounds
          </Link>
          <Link href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 btn-ghost rounded-xl text-sm font-semibold">
            View Pricing
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* ─── Stats bar ────────────────────────────────────── */}
      <section className="relative max-w-4xl mx-auto px-4 -mt-4 mb-16">
        <div className="card rounded-2xl px-2 py-2 grid grid-cols-4 divide-x divide-rim">
          {stats.map((s) => (
            <div key={s.label} className="text-center py-4 px-3">
              <p className="text-xl font-bold text-gradient-brand">{s.value}</p>
              <p className="text-xs text-[#6b6f82] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Recommended / Trending ────────────────────────── */}
      <RecommendedSection mode="personalized" limit={10} />

      {/* ─── Categories ───────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Browse by category</h2>
            <Link href="/browse" className="text-sm text-[#6b6f82] hover:text-accent-bright transition-colors flex items-center gap-1">
              View all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categories.slice(0, 8).map((cat) => (
              <Link
                key={cat.slug}
                href={`/browse?categorySlug=${cat.slug}`}
                className="card rounded-xl p-4 hover:border-accent/30 hover:bg-accent/5 transition-all group flex items-center gap-3"
              >
                <span className="text-2xl">{cat.icon || '🎵'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#c4c6d8] group-hover:text-white transition-colors truncate">{cat.name}</p>
                  <p className="text-xs text-[#5a5d72] mt-0.5">{cat._count.audioAssets} sounds</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Features ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">Everything you need</h2>
          <p className="text-sm text-[#6b6f82]">Built for professional creators, accessible to everyone.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card rounded-2xl p-6 hover:border-rim/50 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-card-glow opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`relative w-11 h-11 rounded-xl ${f.bg} border border-white/[0.06] flex items-center justify-center mb-4 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="relative text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="relative text-sm text-[#6b6f82] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <div className="card rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-glow opacity-50 pointer-events-none" />
          <div className="relative">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">How BeatHive works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Search & Preview', desc: 'Explore the catalog and preview audio directly in your browser.' },
                { step: '02', title: 'Choose Your Plan', desc: 'Subscribe for unlimited access, or buy individual sounds with a perpetual license.' },
                { step: '03', title: 'Download & Create', desc: 'Instantly download your files. Your license PDF is included automatically.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-bright">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                    <p className="text-sm text-[#6b6f82] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/30 via-accent/15 to-teal/20" />
          <div className="absolute inset-0 bg-grid opacity-30" />
          <GlowOrb className="w-64 h-64 bg-accent/30 -top-10 -right-10" />
          <div className="relative px-8 py-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium mb-5 border border-white/10">
              <span className="w-1.5 h-1.5 bg-teal rounded-full animate-pulse" />
              Free plan · No credit card
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Start creating today</h2>
            <p className="text-[#b0b3c8] mb-8 text-sm max-w-sm mx-auto">
              3 free downloads every day. Upgrade anytime for more access and a commercial license.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth/register"
                className="px-6 py-3 bg-white text-accent-dim font-semibold rounded-xl hover:bg-accent-bright hover:text-white transition-all text-sm shadow-elevated">
                Create Free Account
              </Link>
              <Link href="/browse"
                className="px-6 py-3 border border-white/20 text-white font-medium rounded-xl hover:bg-white/10 transition-all text-sm">
                Explore Sounds
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
