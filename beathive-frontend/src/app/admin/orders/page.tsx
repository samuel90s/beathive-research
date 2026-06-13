'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';


interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  user: { name: string; email: string };
  items: { audioAsset: { title: string }; licenseType: string }[];
  invoice?: { invoiceNumber: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  PAID:    'bg-teal/10 text-teal',
  FAILED:  'bg-red-500/10 text-red-400',
  REFUNDED:'bg-white/[0.05] text-[#8b8fa8]',
};

export default function AdminOrdersPage() {
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const token = accessToken || localStorage.getItem('accessToken');
    fetch(`${API}/admin/orders?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setOrders(data.items || []); setTotal(data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">Orders</h1>
        <p className="text-sm text-[#6b6f82] mt-0.5">{total} total orders</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card rounded-2xl border border-rim overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Items</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Invoice</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#c4c6d8]">{o.user.name}</p>
                    <p className="text-xs text-[#6b6f82]">{o.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {o.items.map((item, i) => (
                      <p key={i} className="text-xs text-[#8b8fa8] truncate max-w-[180px]">
                        {item.audioAsset.title}
                        <span className="text-[#6b6f82]"> ({item.licenseType})</span>
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6f82]">
                    {o.invoice?.invoiceNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#c4c6d8]">
                    Rp {(o.totalAmount / 1000).toFixed(0)}rb
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-white/[0.05] text-[#8b8fa8]'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#6b6f82]">
                    {new Date(o.createdAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
