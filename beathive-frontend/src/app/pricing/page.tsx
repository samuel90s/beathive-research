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
  '30-second preview semua SFX',
  'Personal license only',
];

const PRO_FEATURES = [
  '20 downloads per hari',
  'Akses semua Pro & Free SFX',
  'Commercial license included',
  'Original WAV download',
  'Priority support',
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

      <div className="max-w-4xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Choose the right plan</h1>
          <p className="text-[#6b6f82] mb-8">Start free, upgrade anytime. No contracts.</p>

          {/* Duration selector */}
          <div className="inline-flex items-center gap-1 bg-white/[0.05] border border-rim p-1 rounded-xl">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`relative px-4 py-1.5 text-sm rounded-lg transition-all ${
                  duration === d.value
                    ? 'bg-white/[0.08] text-white font-medium shadow-sm'
                    : 'text-[#6b6f82] hover:text-[#c4c6d8]'
                }`}
              >
                {d.label}
                {d.savePercent && (
                  <span className={`ml-1.5 text-[10px] font-semibold ${
                    duration === d.value ? 'text-[#00A79D]' : 'text-[#4a4d5e]'
                  }`}>
                    -{d.savePercent}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2-column plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">

          {/* ── Free ── */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-white">Free</h2>
              <p className="text-xs text-[#6b6f82] mt-0.5">Just getting started</p>
            </div>
            <div className="mb-6">
              <div className="text-3xl font-bold text-white">Free</div>
              <p className="text-xs text-[#5a5d72] mt-1">Selamanya</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#8b8fa8]">
                  <svg className="w-4 h-4 text-[#00A79D] flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
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
              {isAuthenticated ? 'Browse Sounds' : 'Get Started Free'}
            </button>
          </div>

          {/* ── Pro ── */}
          <div className="relative rounded-2xl p-7 flex flex-col bg-accent/10 border-2 border-accent/50 shadow-glow">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-accent text-white text-xs px-3 py-1 rounded-full font-semibold shadow-glow-sm">
                Most Popular
              </span>
            </div>

            <div className="mb-5">
              <h2 className="text-base font-semibold text-white">Pro</h2>
              <p className="text-xs text-[#6b6f82] mt-0.5">For active creators</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{formatPrice(monthlyEquiv)}</span>
                <span className="text-sm text-[#6b6f82]">/mo</span>
              </div>
              {selectedDuration.months > 1 ? (
                <p className="text-xs text-[#00A79D] mt-1">
                  Tagihan {formatPrice(proPrice)} untuk {selectedDuration.label}
                  {selectedDuration.savePercent && (
                    <span className="ml-1">· Hemat {selectedDuration.savePercent}%</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-[#5a5d72] mt-1">Tagihan {formatPrice(proPrice)}/bulan</p>
              )}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
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

        {/* Bottom note */}
        <p className="text-center text-xs text-[#5a5d72] mt-8">
          All plans can be cancelled anytime. Access remains active until the end of the billing period.
        </p>

        {/* Comparison table */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h3 className="text-sm font-semibold text-[#6b6f82] uppercase tracking-widest text-center mb-5">Perbandingan Lengkap</h3>
          <div className="card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rim">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#5a5d72] uppercase tracking-wide w-1/2">Fitur</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[#5a5d72] uppercase tracking-wide">Free</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-accent-bright uppercase tracking-wide">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1b2e]">
                {[
                  { label: 'Download per hari', free: '3 / hari', pro: '20 / hari' },
                  { label: 'Akses sound gratis', free: true, pro: true },
                  { label: 'Akses sound Pro', free: false, pro: true },
                  { label: 'Commercial license', free: false, pro: true },
                  { label: 'Original WAV', free: false, pro: true },
                  { label: 'Preview 30 detik', free: true, pro: true },
                  { label: 'Priority support', free: false, pro: true },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-[#8b8fa8]">{row.label}</td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.free === 'boolean' ? (
                        row.free
                          ? <svg className="w-4 h-4 text-[#00A79D] mx-auto" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M13.28 4.22a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06L6.25 10.19l5.97-5.97a.75.75 0 011.06 0z"/></svg>
                          : <svg className="w-4 h-4 text-[#2a2c3e] mx-auto" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
                      ) : <span className="text-[#8b8fa8] text-xs">{row.free}</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {typeof row.pro === 'boolean' ? (
                        row.pro
                          ? <svg className="w-4 h-4 text-accent-bright mx-auto" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M13.28 4.22a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06L6.25 10.19l5.97-5.97a.75.75 0 011.06 0z"/></svg>
                          : <svg className="w-4 h-4 text-[#2a2c3e] mx-auto" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
                      ) : <span className="text-accent-bright text-xs font-semibold">{row.pro}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
