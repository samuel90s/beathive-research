'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';

type PendingSubscriptionPayment = {
  orderId: string;
  snapToken: string;
  planName: string;
  duration: string;
  durationLabel: string;
  subtotal: number;
  serviceFee: number;
  tax: number;
  grandTotal: number;
};

const PAYMENT_METHODS = [
  { id: 'qris', label: 'QRIS / E-Wallet', desc: 'GoPay, OVO, Dana, ShopeePay, LinkAja' },
  { id: 'va', label: 'Virtual Account', desc: 'BCA, Mandiri, BNI, BRI, Permata' },
  { id: 'card', label: 'Kartu Kredit/Debit', desc: 'Visa, Mastercard, JCB, Amex' },
  { id: 'retail', label: 'Minimarket', desc: 'Alfamart dan Indomaret' },
];

export default function SubscriptionPaymentPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [payment, setPayment] = useState<PendingSubscriptionPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('qris');
  const [paying, setPaying] = useState(false);

  const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
  const snapBaseUrl = isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingSubscriptionPayment');
      if (raw) {
        const data = JSON.parse(raw) as PendingSubscriptionPayment;
        if (data.orderId === orderId) setPayment(data);
      }
    } catch {
      // ignore malformed session data
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const openPayment = useCallback(() => {
    if (!payment?.snapToken) {
      toast.error('Sesi pembayaran tidak ditemukan. Ulangi dari halaman pricing.');
      return;
    }
    setPaying(true);
    window.location.href = `${snapBaseUrl}/snap/v3/redirection/${payment.snapToken}`;
  }, [payment, snapBaseUrl]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <div className="h-20 rounded-2xl bg-white/[0.04] border border-rim animate-pulse" />
            <div className="h-48 rounded-2xl bg-white/[0.04] border border-rim animate-pulse" />
          </div>
          <div className="lg:col-span-2 h-80 rounded-2xl bg-white/[0.04] border border-rim animate-pulse" />
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold text-white mb-2">Sesi pembayaran tidak ditemukan</p>
        <p className="text-sm text-[#6b6f82] mb-6">Silakan pilih plan lagi dari halaman pricing.</p>
        <Link href="/pricing" className="px-5 py-2.5 btn-accent rounded-xl text-sm font-medium">
          Kembali ke Pricing
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
      <nav className="flex items-center gap-2 text-sm text-[#5a5d72] mb-6">
        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        <span>/</span>
        <span className="text-[#8b8fa8]">Pembayaran Pro</span>
      </nav>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-rim bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-widest mb-1">Subscription</p>
                <h1 className="text-xl font-bold text-white">Plan {payment.planName}</h1>
                <p className="text-sm text-[#8b8fa8] mt-1">Durasi {payment.durationLabel}</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                Menunggu Pembayaran
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-rim bg-surface p-5">
            <p className="text-xs font-bold text-[#5a5d72] uppercase tracking-widest mb-4">Rincian Biaya</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b6f82]">Plan Pro ({payment.durationLabel})</span>
                <span className="text-[#c4c6d8]">{formatPrice(payment.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b6f82]">Biaya Layanan (5%)</span>
                <span className="text-[#c4c6d8]">{formatPrice(payment.serviceFee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6b6f82]">PPN (11%)</span>
                <span className="text-[#c4c6d8]">{formatPrice(payment.tax)}</span>
              </div>
              <div className="border-t border-rim pt-3 flex items-center justify-between">
                <span className="font-semibold text-white">Total Pembayaran</span>
                <span className="text-2xl font-bold text-white">{formatPrice(payment.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-rim bg-surface p-5">
            <p className="text-xs font-bold text-[#5a5d72] uppercase tracking-widest mb-4">Pilih Metode Pembayaran</p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    selectedMethod === method.id
                      ? 'border-accent/50 bg-accent/[0.06]'
                      : 'border-rim hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedMethod === method.id ? 'border-accent' : 'border-[#2a2c3e]'}`}>
                    {selectedMethod === method.id && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${selectedMethod === method.id ? 'text-white' : 'text-[#c4c6d8]'}`}>{method.label}</p>
                    <p className="text-[11px] text-[#4a4d5e] mt-0.5 truncate">{method.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rim bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#6b6f82]">Total</span>
              <span className="text-xl font-bold text-white">{formatPrice(payment.grandTotal)}</span>
            </div>
            <button
              onClick={openPayment}
              disabled={paying}
              className="w-full py-3.5 btn-accent rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {paying ? 'Mengalihkan...' : 'Bayar Sekarang'}
            </button>
            <p className="text-center text-[10px] text-[#3a3c4e] mt-3 leading-relaxed">
              Setelah klik bayar, kamu akan diarahkan ke Midtrans untuk menyelesaikan metode yang dipilih.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}