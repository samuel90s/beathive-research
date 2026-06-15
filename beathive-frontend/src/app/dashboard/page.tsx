'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/store/auth.store';

const ACCOUNT_LINKS = [
  {
    href: '/browse',
    title: 'Jelajahi Sound',
    description: 'Cari SFX dan musik untuk proyek berikutnya.',
    color: 'text-accent-bright bg-accent/10 border-accent/20',
  },
  {
    href: '/wishlist',
    title: 'Wishlist',
    description: 'Lihat sound yang sudah kamu simpan.',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    href: '/dashboard/downloads',
    title: 'Riwayat Download',
    description: 'Unduh kembali file dan lisensi milikmu.',
    color: 'text-teal bg-teal/10 border-teal/20',
  },
  {
    href: '/dashboard/orders',
    title: 'Pesanan',
    description: 'Periksa status pembayaran dan invoice.',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

export default function DashboardPage() {
  const isAuthenticated = useRequireAuth();
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated || !user) return null;

  const plan = user.subscription?.plan;
  const usage = user.subscription?.usage;
  const remaining = usage?.remaining;

  return (
    <div className="px-5 py-7 md:px-8 md:py-8 pb-28">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-bright">Akun Saya</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Halo, {user.name}</h1>
          <p className="mt-1 text-sm text-[#6b6f82]">Kelola aktivitas pembelian dan download dari satu tempat.</p>
        </div>
        <Link href="/profile" className="btn-ghost rounded-xl px-4 py-2.5 text-sm font-medium">
          Edit Profil
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="card rounded-2xl p-5">
          <p className="text-xs text-[#6b6f82]">Paket saat ini</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{plan?.name ?? 'Free'}</h2>
              <p className="mt-1 text-sm text-[#5a5d72]">
                {remaining == null ? 'Cek detail limit di halaman Pricing.' : `${remaining} download tersisa hari ini.`}
              </p>
            </div>
            <Link href="/pricing" className="btn-accent rounded-xl px-4 py-2 text-sm font-semibold">
              Lihat Paket
            </Link>
          </div>
        </section>

        <section className="card rounded-2xl p-5">
          <p className="text-xs text-[#6b6f82]">Punya karya audio?</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Mulai menjadi kreator</h2>
          <p className="mt-1 text-sm text-[#5a5d72]">Upload, pantau review, dan kelola penghasilan melalui Studio.</p>
          <Link href="/studio" className="mt-4 inline-flex text-sm font-semibold text-accent-bright hover:underline">
            Buka Studio
          </Link>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACCOUNT_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="card group rounded-2xl p-5 transition hover:border-white/10 hover:bg-lift">
            <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.color}`}>
              {item.title}
            </span>
            <p className="mt-3 text-sm text-[#6b6f82] group-hover:text-[#8b8fa8]">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
