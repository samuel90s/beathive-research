'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { formatPrice, formatDate } from '@/lib/utils';
import { ordersApi } from '@/lib/api/orders';
import { useDownload } from '@/lib/hooks/useDownload';
import { useCartStore } from '@/lib/store/cart.store';
import { toast } from '@/lib/store/toast.store';
import { SERVICE_FEE_PERCENT, TAX_PERCENT } from '@/lib/constants';

interface InvoiceData {
  orderId: string;
  invoiceNumber: string;
  issuedAt: string;
  customer: { name: string; email: string };
  items: { title: string; soundId: string; slug: string; format: string; licenseType: string; price: number }[];
  subtotal: number;
}

function OrderSuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.id as string;

  // Midtrans redirect sends ?transaction_status=settlement/capture/pending/deny/cancel/expire
  // Our own callbacks send ?status=pending or ?status=error
  const txStatus = searchParams.get('transaction_status');
  const ourStatus = searchParams.get('status');

  const isSuccess = txStatus === 'settlement' || txStatus === 'capture';
  const isPending = ourStatus === 'pending' || txStatus === 'pending';
  const isError = ourStatus === 'error' || txStatus === 'deny' || txStatus === 'cancel' || txStatus === 'expire';

  const clearCart = useCartStore(s => s.clearCart);
  const { download, downloading } = useDownload();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    // If user cancelled/error — don't verify or fetch invoice, just show the error state
    if (isError) { setLoading(false); return; }

    const init = async () => {
      try {
        await apiClient.post('/orders/verify-payment', { orderId }).catch(() => {});
        // Retry invoice fetch — it's created async after webhook fires
        let inv = null;
        for (let i = 0; i < 5; i++) {
          try {
            inv = await ordersApi.getInvoice(orderId);
            break;
          } catch {
            await new Promise(r => setTimeout(r, 800));
          }
        }
        if (inv) {
          setInvoice(inv);
          // Only clear cart after confirmed payment
          clearCart();
          sessionStorage.removeItem('pendingOrder');
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [orderId, isError, clearCart]);

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloadingPdf(true);
    try { await ordersApi.downloadInvoicePdf(orderId, invoice.invoiceNumber); }
    catch { /* ignore */ } finally { setDownloadingPdf(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#5a5d72]">Mengonfirmasi pembayaran...</p>
      </div>
    );
  }

  // Cancelled / error state — order still exists and is PENDING, user can retry
  if (isError) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a1b2e] border border-[#2a2c3e] flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b6f82" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Pembayaran Dibatalkan</h1>
          <p className="text-sm text-[#6b6f82] mb-1">Transaksi kamu dibatalkan.</p>
          <p className="text-sm text-[#6b6f82] mb-6">
            Keranjang kamu masih tersimpan — kamu bisa melanjutkan pembayaran.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/orders/${orderId}/pay`)}
              className="w-full py-3 btn-accent rounded-xl text-sm font-semibold"
            >
              Coba Bayar Lagi
            </button>
            <button
              onClick={() => router.push('/checkout')}
              className="w-full py-3 rounded-xl text-sm font-medium border border-rim text-[#8b8fa8] hover:text-white hover:border-white/10 transition-colors"
            >
              Kembali ke Keranjang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending state
  if (isPending || !invoice) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Pembayaran Diproses</h1>
          <p className="text-sm text-[#6b6f82] mb-1">Pembayaran kamu sedang dikonfirmasi.</p>
          <p className="text-sm text-[#6b6f82] mb-6">Download akan tersedia setelah pembayaran berhasil.</p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="w-full py-3 btn-accent rounded-xl text-sm font-semibold"
            >
              Lihat Status Pesanan
            </button>
            <button
              onClick={() => router.push('/browse')}
              className="w-full py-3 rounded-xl text-sm font-medium border border-rim text-[#8b8fa8] hover:text-white hover:border-white/10 transition-colors"
            >
              Browse Sounds
            </button>
          </div>
        </div>
      </div>
    );
  }

  const serviceFee = Math.round(invoice.subtotal * SERVICE_FEE_PERCENT / 100);
  const tax = Math.round((invoice.subtotal + serviceFee) * TAX_PERCENT / 100);
  const grandTotal = invoice.subtotal + serviceFee + tax;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Success header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Pembayaran Berhasil!</h1>
          <p className="text-sm text-[#6b6f82] mt-1">Sound effects kamu siap untuk didownload</p>
        </div>

        {/* Invoice card */}
        <div className="rounded-2xl border border-rim overflow-hidden mb-4">
          {/* Header strip */}
          <div className="bg-accent px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white tracking-tight">arsonus</span>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                Paid ✓
              </span>
            </div>
            <p className="text-sm text-orange-100 font-mono">{invoice.invoiceNumber}</p>
            <p className="text-xs text-orange-200/80 mt-0.5">{formatDate(invoice.issuedAt)}</p>
          </div>

          <div className="bg-surface px-5 py-4">
            {/* Customer info */}
            <div className="mb-4 pb-3.5 border-b border-rim">
              <p className="text-[10px] font-bold text-[#3a3c4e] uppercase tracking-widest mb-1.5">Pelanggan</p>
              <p className="text-sm font-medium text-white">{invoice.customer.name}</p>
              <p className="text-xs text-[#5a5d72]">{invoice.customer.email}</p>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-4">
              {invoice.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-accent/[0.08] border border-accent/[0.12] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{item.title}</p>
                      <p className="text-xs text-[#5a5d72] mt-0.5 capitalize">{item.licenseType} · {formatPrice(item.price)}</p>
                    </div>
                  </div>
                  {item.soundId && (
                    <button
                      onClick={async () => {
                        try { await download(item.soundId, item.slug ?? item.title.toLowerCase().replace(/\s+/g, '-'), item.format ?? 'wav'); }
                        catch (err: any) { toast.error(err.message || 'Download gagal'); }
                      }}
                      disabled={downloading === item.soundId}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-dim flex-shrink-0 disabled:opacity-50 transition-colors font-medium"
                    >
                      {downloading === item.soundId ? (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      )}
                      Download
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-t border-rim pt-3.5 space-y-2">
              <div className="flex justify-between text-xs text-[#5a5d72]">
                <span>Subtotal</span>
                <span>{formatPrice(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#5a5d72]">
                <span>Biaya Layanan ({SERVICE_FEE_PERCENT}%)</span>
                <span>{formatPrice(serviceFee)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#5a5d72]">
                <span>PPN ({TAX_PERCENT}%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-rim">
                <span>Total Dibayar</span>
                <span className="text-accent-bright">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-rim text-[#8b8fa8] hover:text-white hover:border-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloadingPdf ? 'Downloading...' : 'Invoice PDF'}
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-semibold transition-colors"
          >
            Lihat Pembelian
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
