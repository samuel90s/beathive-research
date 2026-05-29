'use client';
// src/components/ui/InvoiceModal.tsx
import { useEffect } from 'react';
import { formatPrice, formatDate } from '@/lib/utils';
import { calcOrderTotals, SERVICE_FEE_PERCENT, TAX_PERCENT } from '@/lib/constants';

export interface InvoiceData {
  orderId: string;
  invoiceNumber: string;
  issuedAt: string;
  customer: { name: string; email: string };
  items: { title: string; licenseType: string; price: number }[];
  subtotal: number;
}

interface Props {
  invoice: InvoiceData;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
  closeLabel?: string;
}

export function InvoiceModal({ invoice, onClose, onDownload, downloading, closeLabel = 'Close' }: Props) {
  const { serviceFee, tax, grandTotal } = calcOrderTotals(invoice.subtotal);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card-lift rounded-2xl shadow-elevated w-full max-w-md overflow-hidden border border-rim">
        {/* Header */}
        <div className="bg-accent px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-lg font-bold">Arsonus</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Payment Successful ✓</span>
          </div>
          <p className="text-sm text-accent-bright/80">{invoice.invoiceNumber}</p>
          <p className="text-xs text-accent-bright/60 mt-0.5">{formatDate(invoice.issuedAt)}</p>
        </div>

        <div className="px-6 py-4">
          {/* Customer */}
          <div className="mb-4 pb-4 border-b border-rim">
            <p className="text-xs text-[#6b6f82] mb-1">Customer</p>
            <p className="text-sm font-medium text-[#c4c6d8]">{invoice.customer.name}</p>
            <p className="text-xs text-[#6b6f82]">{invoice.customer.email}</p>
          </div>

          {/* Items */}
          <div className="mb-4 space-y-2">
            {invoice.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-[#c4c6d8] font-medium">{item.title}</p>
                  <p className="text-xs text-[#6b6f82] capitalize">{item.licenseType} license</p>
                </div>
                <span className="text-sm text-[#c4c6d8] flex-shrink-0">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="border-t border-rim pt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-[#6b6f82]">
              <span>Subtotal</span><span>{formatPrice(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#6b6f82]">
              <span>Service Fee ({SERVICE_FEE_PERCENT}%)</span><span>{formatPrice(serviceFee)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#6b6f82]">
              <span>VAT ({TAX_PERCENT}%)</span><span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-rim">
              <span>Total</span>
              <span className="text-accent-bright">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={onDownload}
            disabled={downloading}
            className="flex-1 py-2.5 border border-accent/30 text-accent-bright text-sm font-medium rounded-xl hover:bg-accent/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? 'Downloading...' : 'Invoice PDF'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 btn-accent text-sm font-medium rounded-xl transition-colors">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
