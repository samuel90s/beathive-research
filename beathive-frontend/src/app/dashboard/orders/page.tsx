// src/app/dashboard/orders/page.tsx
'use client';
import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/hooks/useAuth';
import { ordersApi } from '@/lib/api/orders';
import { useDownload } from '@/lib/hooks/useDownload';
import { formatPrice } from '@/lib/utils';
import { InvoiceModal, type InvoiceData } from '@/components/ui/InvoiceModal';
import { toast } from '@/lib/store/toast.store';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PAID:      { label: 'Successful', cls: 'bg-teal/10 text-teal border border-teal/20' },
  PENDING:   { label: 'Pending',    cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  CANCELLED: { label: 'Cancelled',  cls: 'bg-white/[0.05] text-[#6b6f82] border border-rim' },
  FAILED:    { label: 'Failed',     cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Successful' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['value'];

function formatOrderDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function OrdersContent() {
  const isAuth = useRequireAuth();
  const { download, downloading } = useDownload();
  const queryClient = useQueryClient();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null);
  const [popupInvoice, setPopupInvoice] = useState<InvoiceData | null>(null);
  const [popupDownloading, setPopupDownloading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const closePopup = useCallback(() => setPopupInvoice(null), []);
  useEffect(() => {
    if (!popupInvoice) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [popupInvoice, closePopup]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: ordersApi.getMyOrders,
    enabled: isAuth,
  });
  const filteredOrders = useMemo(() => {
    const list = orders ?? [];
    if (statusFilter === 'ALL') return list;
    if (statusFilter === 'CANCELLED') return list.filter((order) => order.status === 'CANCELLED' || order.status === 'FAILED');
    return list.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);
  const statusCounts = useMemo(() => {
    const list = orders ?? [];
    return {
      ALL: list.length,
      PAID: list.filter((order) => order.status === 'PAID').length,
      PENDING: list.filter((order) => order.status === 'PENDING').length,
      CANCELLED: list.filter((order) => order.status === 'CANCELLED' || order.status === 'FAILED').length,
    } satisfies Record<StatusFilter, number>;
  }, [orders]);

  const handleDownloadInvoice = async (orderId: string, invoiceNumber: string) => {
    setInvoiceLoading(orderId);
    try { await ordersApi.downloadInvoicePdf(orderId, invoiceNumber); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to download invoice'); }
    finally { setInvoiceLoading(null); }
  };

  const handleContinuePayment = async (orderId: string) => {
    setActionLoading(orderId + '-pay');
    try {
      const { snapToken } = await ordersApi.getSnapToken(orderId);
      if (typeof window !== 'undefined' && (window as any).snap) {
        (window as any).snap.pay(snapToken, {
          onSuccess: async () => {
            try { await ordersApi.verifyPayment(orderId); } catch { /* webhook handles this */ }
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            try {
              const inv = await ordersApi.getInvoice(orderId);
              setPopupInvoice(inv);
            } catch { /* invoice may not be ready */ }
          },
          onPending: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
          onError: () => toast.error('Payment failed. Please try again.'),
        });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to open payment session');
    } finally { setActionLoading(null); }
  };

  const doCancelOrder = async (orderId: string) => {
    setActionLoading(orderId + '-cancel');
    try {
      await ordersApi.cancelOrder(orderId);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel order');
    } finally { setActionLoading(null); }
  };

  if (isLoading) return (
    <div className="px-6 py-8 space-y-3">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="h-28 card rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <>
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-lift rounded-2xl border border-rim w-full max-w-sm p-6 shadow-elevated">
            <p className="text-sm text-[#c4c6d8] mb-5 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-rim text-[#8b8fa8] hover:bg-white/[0.05] transition-colors">
                No
              </button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {popupInvoice && (
        <InvoiceModal
          invoice={popupInvoice}
          onClose={closePopup}
          onDownload={async () => {
            setPopupDownloading(true);
            try { await ordersApi.downloadInvoicePdf(popupInvoice.orderId, popupInvoice.invoiceNumber); }
            catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to download invoice'); }
            finally { setPopupDownloading(false); }
          }}
          downloading={popupDownloading}
        />
      )}

      <div className="px-8 py-8 pb-28">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-lg font-bold text-white">Orders</h1>
          <span className="text-xs text-[#3a3c4e] tabular-nums">{orders?.length ?? 0}</span>
        </div>

        {!!orders?.length && (
          <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-none">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === filter.value
                    ? 'bg-white text-black'
                    : 'bg-white/[0.04] text-[#8b8fa8] hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {filter.label}
                <span className={`ml-1.5 tabular-nums ${statusFilter === filter.value ? 'text-black/60' : 'text-[#4a4d5e]'}`}>
                  {statusCounts[filter.value]}
                </span>
              </button>
            ))}
          </div>
        )}

        {!orders?.length ? (
          <div className="card rounded-2xl py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b6f82" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-[#6b6f82]">No orders yet</p>
            <Link href="/browse" className="mt-2 inline-block text-xs text-accent-bright hover:underline">
              Browse sounds
            </Link>
          </div>
        ) : !filteredOrders.length ? (
          <div className="card rounded-2xl py-16 text-center">
            <p className="text-sm font-medium text-[#8b8fa8]">No {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase()} orders</p>
            <button onClick={() => setStatusFilter('ALL')} className="mt-3 text-xs text-accent-bright hover:underline">
              Show all orders
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((order) => {
              const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.FAILED;
              const itemNames = order.items.map(i => i.audioAsset?.title).filter(Boolean);
              const summary = itemNames.length === 0
                ? `Order #${order.id.slice(0, 8)}`
                : itemNames.length === 1
                  ? itemNames[0]
                  : `${itemNames[0]} +${itemNames.length - 1} more`;
              return (
                <div key={order.id} className="card rounded-xl border border-rim">
                  {/* Order row */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    {/* Status badge */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${st.cls}`}>{st.label}</span>

                      {/* Items summary */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#c4c6d8] truncate">
                          {summary}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#5a5d72]">{formatOrderDate(order.createdAt)}</span>
                        {order.invoice && (
                          <>
                            <span className="text-[#2a2c3e]">·</span>
                            <span className="text-[10px] font-mono text-[#3a3c4e]">{order.invoice.invoiceNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <p className="text-sm font-bold text-white tabular-nums flex-shrink-0">{formatPrice(order.totalAmount)}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {order.status === 'PAID' && order.invoice && (
                        <button
                          onClick={() => handleDownloadInvoice(order.id, order.invoice!.invoiceNumber)}
                          disabled={invoiceLoading === order.id}
                          title="Download Invoice"
                          className="w-7 h-7 rounded-lg border border-rim text-[#6b6f82] hover:text-accent-bright hover:border-accent/30 flex items-center justify-center transition-all disabled:opacity-40"
                        >
                          {invoiceLoading === order.id ? (
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          )}
                        </button>
                      )}
                      {order.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleContinuePayment(order.id)}
                            disabled={actionLoading === order.id + '-pay'}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg btn-accent disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === order.id + '-pay' ? '...' : 'Pay'}
                          </button>
                          <button
                            onClick={() => setConfirmModal({ message: 'Cancel this order?', onConfirm: () => doCancelOrder(order.id) })}
                            disabled={actionLoading === order.id + '-cancel'}
                            className="w-7 h-7 rounded-lg border border-rim text-[#6b6f82] hover:text-red-400 hover:border-red-500/30 flex items-center justify-center transition-all disabled:opacity-40"
                            title="Cancel"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded items (show if more than 1 item) */}
                  {order.items.length > 1 && (
                    <div className="border-t border-rim px-4 py-2 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 py-1">
                          <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                              <rect x="1" y="4" width="3" height="8" rx="1" fill="#F7941D"/>
                              <rect x="5.5" y="2" width="3" height="12" rx="1" fill="#F7941D"/>
                              <rect x="10" y="5" width="3" height="6" rx="1" fill="#F7941D"/>
                            </svg>
                          </div>
                          <p className="text-xs text-[#8b8fa8] truncate flex-1">{item.audioAsset?.title ?? 'Untitled item'}</p>
                          <span className="text-[10px] text-[#5a5d72] capitalize">{item.licenseType}</span>
                          <span className="text-xs text-[#5a5d72] tabular-nums">{formatPrice(item.priceSnapshot)}</span>
                          {order.status === 'PAID' && (
                            <button
                              onClick={() => item.audioAsset && download(item.audioAsset.id, item.audioAsset.slug, item.audioAsset.format)}
                              disabled={!item.audioAsset || downloading === item.audioAsset.id}
                              title="Download"
                              className="w-6 h-6 rounded border border-teal/20 text-teal/60 hover:text-teal hover:border-teal/40 flex items-center justify-center transition-all disabled:opacity-40"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Single item: show download button inline */}
                  {order.items.length === 1 && order.status === 'PAID' && (
                    <div className="border-t border-rim px-4 py-2 flex items-center gap-3">
                      <span className="text-[10px] text-[#5a5d72] capitalize">{order.items[0].licenseType} License</span>
                      <button
                        onClick={() => order.items[0].audioAsset && download(order.items[0].audioAsset.id, order.items[0].audioAsset.slug, order.items[0].audioAsset.format)}
                        disabled={!order.items[0].audioAsset || downloading === order.items[0].audioAsset.id}
                        className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-teal/20 text-teal/70 hover:text-teal hover:border-teal/40 transition-all disabled:opacity-40"
                      >
                        {order.items[0].audioAsset && downloading === order.items[0].audioAsset.id ? (
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        )}
                        Download
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-28 card rounded-2xl animate-pulse" />)}</div>}>
      <OrdersContent />
    </Suspense>
  );
}
