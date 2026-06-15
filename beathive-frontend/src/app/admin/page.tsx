'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';


interface Stats {
  users: number;
  sounds: number;
  pendingSounds: number;
  orders: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const { accessToken } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const token = accessToken || sessionStorage.getItem('accessToken');
    fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = stats ? [
    { label: 'Total Users', value: stats.users.toLocaleString('id'), color: 'text-teal', bg: 'bg-teal/10' },
    { label: 'Total Sounds', value: stats.sounds.toLocaleString('id'), color: 'text-accent-bright', bg: 'bg-accent/10' },
    { label: 'Pending Review', value: stats.pendingSounds.toLocaleString('id'), color: 'text-amber-600', bg: 'bg-amber-50', urgent: stats.pendingSounds > 0 },
    { label: 'Active Subscribers', value: stats.activeSubscriptions.toLocaleString('id'), color: 'text-teal', bg: 'bg-teal-50' },
    { label: 'Completed Orders', value: stats.orders.toLocaleString('id'), color: 'text-[#8b8fa8]', bg: 'bg-white/[0.03]' },
    { label: 'Total Revenue', value: `Rp ${(stats.totalRevenue / 1000).toFixed(0)}rb`, color: 'text-green-600', bg: 'bg-green-50' },
  ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-[#6b6f82] mt-0.5">BeatHive Platform Overview</p>
      </div>

      {!stats ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className={`card rounded-2xl border p-5 ${card.urgent ? 'border-amber-200' : 'border-rim'}`}>
              <p className="text-xs text-[#6b6f82] mb-2">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              {card.urgent && (
                <p className="text-xs text-amber-600 mt-1 font-medium">Needs review</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
