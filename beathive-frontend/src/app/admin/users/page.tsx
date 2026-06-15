'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL as API } from '@/lib/config';
import { useAuthStore } from '@/lib/store/auth.store';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  subscription?: { plan: { name: string; slug: string }; status: string } | null;
  _count: { uploadedAssets: number; orders: number };
}

interface Plan {
  id: string;
  name: string;
  slug: string;
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  planSlug: string;
}

const EMPTY_FORM: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
  planSlug: 'free',
};

export default function AdminUsersPage() {
  const { accessToken, user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || sessionStorage.getItem('accessToken') || ''}`,
  }), [accessToken]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(`${API}${url}`, {
      ...init,
      headers: { ...authHeaders(), ...init?.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      throw new Error(message || 'Request failed');
    }
    return data;
  }, [authHeaders]);

  const fetchUsers = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const data = await request(`/admin/users?search=${encodeURIComponent(query)}&limit=100`);
      setUsers(data.items || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat users');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    request('/admin/plans')
      .then(setPlans)
      .catch((error) => toast.error(error.message));
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchUsers(search), 300);
    return () => window.clearTimeout(timer);
  }, [fetchUsers, search]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      planSlug: user.subscription?.plan.slug || 'free',
    });
    setShowForm(true);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body: Partial<UserForm> = { ...form };
      if (editingUser && !body.password) delete body.password;
      await request(
        editingUser ? `/admin/users/${editingUser.id}` : '/admin/users',
        {
          method: editingUser ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        },
      );
      toast.success(editingUser ? 'User berhasil diperbarui' : 'User berhasil dibuat');
      setShowForm(false);
      await fetchUsers(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Hapus permanen user "${user.name}" (${user.email})?`)) return;
    try {
      await request(`/admin/users/${user.id}`, { method: 'DELETE' });
      toast.success('User berhasil dihapus');
      await fetchUsers(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus user');
    }
  };

  const planColors: Record<string, string> = {
    free: 'bg-white/[0.05] text-[#8b8fa8]',
    pro: 'bg-accent/10 text-accent-bright',
    business: 'bg-teal/10 text-teal',
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="mt-0.5 text-sm text-[#6b6f82]">{total} user terdaftar</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Plus size={16} /> Tambah User
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4 w-full rounded-xl border border-rim bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="card overflow-x-auto rounded-2xl border border-rim">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-rim bg-white/[0.03]">
                {['User', 'Role', 'Plan', 'Sounds', 'Orders', 'Joined', 'Actions'].map((label) => (
                  <th key={label} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6f82] ${['Sounds', 'Orders', 'Joined', 'Actions'].includes(label) ? 'text-right' : 'text-left'}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#c4c6d8]">{user.name}</p>
                    <p className="text-xs text-[#6b6f82]">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.05] text-[#8b8fa8]'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${planColors[user.subscription?.plan.slug || 'free'] || planColors.free}`}>
                      {user.subscription?.plan.name || 'No plan'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#8b8fa8]">{user._count.uploadedAssets}</td>
                  <td className="px-4 py-3 text-right text-[#8b8fa8]">{user._count.orders}</td>
                  <td className="px-4 py-3 text-right text-xs text-[#6b6f82]">
                    {new Date(user.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        title="Edit user"
                        className="rounded-lg border border-rim p-2 text-[#8b8fa8] hover:border-accent/50 hover:text-accent"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? 'Tidak dapat menghapus akun sendiri' : 'Hapus user'}
                        className="rounded-lg border border-rim p-2 text-[#8b8fa8] hover:border-red-500/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <p className="py-12 text-center text-sm text-[#6b6f82]">User tidak ditemukan.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submitForm} className="w-full max-w-lg rounded-2xl border border-rim bg-[#111218] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{editingUser ? 'Edit User' : 'Tambah User'}</h2>
                <p className="text-xs text-[#6b6f82]">{editingUser ? 'Perbarui akun, role, atau plan.' : 'Buat akun baru secara manual.'}</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[#8b8fa8] hover:bg-white/5 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[#8b8fa8]">Nama</span>
                <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-rim bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[#8b8fa8]">Email</span>
                <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-rim bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#8b8fa8]">Role</span>
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserForm['role'] })} className="w-full rounded-xl border border-rim bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#8b8fa8]">Plan</span>
                <select value={form.planSlug} onChange={(event) => setForm({ ...form, planSlug: event.target.value })} className="w-full rounded-xl border border-rim bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent">
                  {plans.map((plan) => <option key={plan.id} value={plan.slug}>{plan.name}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[#8b8fa8]">
                  Password {editingUser && <span className="font-normal text-[#55596c]">(kosongkan jika tidak diubah)</span>}
                </span>
                <input required={!editingUser} minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-xl border border-rim bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-rim px-4 py-2.5 text-sm text-[#a7aabc] hover:bg-white/5">Batal</button>
              <button disabled={saving} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
