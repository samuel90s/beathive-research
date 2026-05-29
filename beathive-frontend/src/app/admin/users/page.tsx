'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';


interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  subscription?: { plan: { name: string; slug: string }; status: string } | null;
  _count: { uploadedSounds: number; orders: number };
}

export default function AdminUsersPage() {
  const { accessToken } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const token = () => accessToken || localStorage.getItem('accessToken');

  const fetchUsers = async (q = '') => {
    setLoading(true);
    const res = await fetch(`${API}/admin/users?search=${q}&limit=50`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    setUsers(data.items || []);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const PLAN_COLORS: Record<string, string> = {
    free: 'bg-white/[0.05] text-[#8b8fa8]',
    pro: 'bg-accent/10 text-accent-bright',
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="text-sm text-[#6b6f82] mt-0.5">{total} user terdaftar</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => { setSearch(e.target.value); fetchUsers(e.target.value); }}
        className="w-full px-4 py-2.5 border border-rim rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4 bg-surface"
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card rounded-2xl border border-rim overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Sounds</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Orders</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#c4c6d8]">{u.name}</p>
                    <p className="text-xs text-[#6b6f82]">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'ADMIN' ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.05] text-[#8b8fa8]'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.subscription ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.subscription.plan.slug] || 'bg-white/[0.05] text-[#8b8fa8]'}`}>
                        {u.subscription.plan.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#6b6f82]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#8b8fa8]">{u._count.uploadedSounds}</td>
                  <td className="px-4 py-3 text-right text-[#8b8fa8]">{u._count.orders}</td>
                  <td className="px-4 py-3 text-right text-[#6b6f82] text-xs">
                    {new Date(u.createdAt).toLocaleDateString('en-GB')}
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
