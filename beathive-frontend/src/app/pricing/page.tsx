// src/app/pricing/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { formatPrice } from '@/lib/utils';

const SERVICE_FEE_PERCENT = 5;
const TAX_PERCENT = 11;

type Duration = '1month' | '3months' | '6months' | '12months';

const DURATIONS: { value: Duration; label: string; months: number; savePercent: number | null }[] = [
  { value: '1month',  label: '1 Bulan',  months: 1,  savePercent: null },
  { value: '3months', label: '3 Bulan',  months: 3,  savePercent: 13   },
  { value: '6months', label: '6 Bulan',  months: 6,  savePercent: 20   },
  { value: '12months',label: '12 Bulan', months: 12, savePercent: 27   },
];

// Base price per month for Pro
const PRO_BASE_MONTHLY = 25000;

// Total price for each duration
const PRO_PRICES: Record<Duration, number> = {
  '1month':  25000,
  '3months': 65000,
  '6months': 120000,
  '12months': 220000,
};

interface ConfirmPlan {
  slug: string;
  name: string;
  price: number;
  duration: Duration;
  durationLabel: string;
}

function ConfirmModal({ plan, onConfirm, onClose, loading }: {
  plan: ConfirmPlan; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const serviceFee = Math.round(plan.price * SERVICE_FEE_PERCENT / 100);
  const tax = Math.round((plan.price + serviceFee) * TAX_PERCENT / 100);
  const total = plan.price + serviceFee + tax;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card-lift rounded-2xl shadow-elevated w-full max-w-sm overflow-hidden border border-rim animate-fade-up">
        <div className="bg-accent px-6 py-5">
          <p className="text-base font-bold text-white">Konfirmasi Berlangganan</p>
          <p className="text-sm text-white/80 mt-0.5">Plan {plan.name} · {plan.durationLabel}</p>
        </div>
        <div className="px-6 py-5 space-y-2.5">
          <div className="flex justify-between text-sm text-[#8b8fa8]">
            <span>Plan {plan.name} ({plan.durationLabel})</span>
            <span className="text-[#c4c6d8]">{formatPrice(plan.price)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#6b6f82]">
            <span>Biaya Layanan ({SERVICE_FEE_PERCENT}%)</span>
            <span>{formatPrice(serviceFee)}</span>
          </div>
          <div className="flex justify-between text-sm text-[#6b6f82]">
            <span>PPN ({TAX_PERCENT}%)</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="border-t border-rim pt-2.5 flex justify-between font-bold">
            <span className="text-sm text-white">Total</span>
            <span className="text-accent-bright">{formatPrice(total)}</span>
          </div>
          <p className="text-xs text-[#5a5d72] pt-1 leading-relaxed">
            Akses aktif langsung setelah pembayaran dikonfirmasi. Bisa dibatalkan kapan saja.
          </p>
        </div>
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium disabled:opacity-50">
            Batal
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</>
            ) : `Bayar ${formatPrice(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const FREE_FEATURES = [
  '3 downloads per hari',
  'Akses semua sound gratis',
  'Preview semua audio',
  'Personal license',
];

const PRO_FEATURES = [
  '20 downloads per hari',
  'Akses semua Pro & Free',
  'Commercial license',
  'Original WAV download',
];

export default function PricingPage() {
  const [duration, setDuration] = useState<Duration>('1month');
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPlan | null>(null);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const proPrice = PRO_PRICES[duration];
  const selectedDuration = DURATIONS.find(d => d.value === duration)!;
  const monthlyEquiv = Math.round(proPrice / selectedDuration.months);

  const handleClickPro = () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    setConfirm({
      slug: 'pro',
      name: 'Pro',
      price: proPrice,
      duration,
      durationLabel: selectedDuration.label,
    });
  };

  const handleConfirmPay = async () => {
    if (!confirm) return;
    setLoading('pro');
    try {
      const result = await subscriptionsApi.upgrade(confirm.slug, confirm.duration as any);
      setConfirm(null);
      if ((window as any).snap) {
        (window as any).snap.pay(result.snapToken, {
          onSuccess: async () => {
            try { await subscriptionsApi.verifyPayment(result.orderId); } catch { /* webhook */ }
            router.push('/studio?upgrade=success');
          },
          onError: () => setLoading(null),
          onClose: () => setLoading(null),
        });
      }
    } catch { setLoading(null); }
  };

  return (
    <>
      {confirm && (
        <ConfirmModal
          plan={confirm}
          onConfirm={handleConfirmPay}
          onClose={() => setConfirm(null)}
          loading={loading === 'pro'}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-7">
          <p className="text-xs font-semibold text-accent-bright uppercase tracking-[0.16em] mb-2">Pricing</p>
          <h1 className="text-2xl font-bold text-white">Pilih plan</h1>
          <p className="text-sm text-[#6b6f82] mt-1">Mulai gratis, upgrade saat butuh akses lebih.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card rounded-2xl p-5 flex flex-col border border-rim">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">Free</h2>
                <p className="text-xs text-[#6b6f82] mt-0.5">Untuk coba-coba dulu</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-white/[0.04] text-[#8b8fa8] border border-white/[0.06]">Selamanya</span>
            </div>

            <div className="text-2xl font-bold text-white mb-5">Free</div>

            <ul className="space-y-2.5 mb-6 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#8b8fa8]">
                  <svg className="w-4 h-4 text-teal flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M13.28 4.22a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06L6.25 10.19l5.97-5.97a.75.75 0 011.06 0z"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push(isAuthenticated ? '/browse' : '/auth/register')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold btn-ghost transition-all"
            >
              {isAuthenticated ? 'Browse Sounds' : 'Mulai Gratis'}
            </button>
          </div>

          <div className="rounded-2xl p-5 flex flex-col bg-accent/[0.08] border border-accent/40">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">Pro</h2>
                <p className="text-xs text-[#6b6f82] mt-0.5">Untuk creator aktif</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-accent text-white font-semibold">Popular</span>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-black/20 border border-white/[0.06] p-1 rounded-xl mb-5">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={duration === d.value
                    ? 'px-2 py-1.5 text-xs rounded-lg transition-all bg-white text-black font-semibold'
                    : 'px-2 py-1.5 text-xs rounded-lg transition-all text-[#8b8fa8] hover:text-white hover:bg-white/[0.05]'}
                >
                  {d.label}
                  {d.savePercent && <span className="ml-1 opacity-70">-{d.savePercent}%</span>}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{formatPrice(monthlyEquiv)}</span>
                <span className="text-sm text-[#6b6f82]">/mo</span>
              </div>
              <p className="text-xs text-[#5a5d72] mt-1">
                Tagihan {formatPrice(proPrice)} untuk {selectedDuration.label}
              </p>
            </div>

            <ul className="space-y-2.5 mb-6 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#c4c6d8]">
                  <svg className="w-4 h-4 text-accent-bright flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M13.28 4.22a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06L6.25 10.19l5.97-5.97a.75.75 0 011.06 0z"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={handleClickPro}
              disabled={loading === 'pro'}
              className="w-full py-2.5 rounded-xl text-sm font-semibold btn-accent transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading === 'pro' ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
              ) : 'Start Pro'}
            </button>
          </div>
        </div>

        <p className="text-xs text-[#5a5d72] mt-5">
          Bisa dibatalkan kapan saja. Akses tetap aktif sampai akhir periode billing.
        </p>
      </div>
    </>
  );
}
