'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from '@/lib/store/toast.store';


interface Category { id: string; name: string; slug: string; icon?: string; _count: { audioAssets: number } }

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminCategoriesPage() {
  const { accessToken } = useAuthStore();
  const token = () => accessToken || sessionStorage.getItem('accessToken') || '';

  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', icon: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`${API}/admin/categories`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setCats(Array.isArray(d) ? d : d.items ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (cat: Category) => {
    setEditId(cat.id);
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon || '' });
    setError(null);
  };

  const startCreate = () => {
    setEditId('new');
    setForm({ name: '', slug: '', icon: '' });
    setError(null);
  };

  const cancel = () => { setEditId(null); setError(null); };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug required'); return; }
    setSaving(true); setError(null);
    try {
      const method = editId === 'new' ? 'POST' : 'PATCH';
      const url = editId === 'new' ? `${API}/admin/categories` : `${API}/admin/categories/${editId}`;
      const res = await fetch(url, {
        method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), slug: form.slug.trim(), icon: form.icon.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      setEditId(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    const res = await fetch(`${API}/admin/categories/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.message || 'Failed to delete category'); return; }
    toast.success(`Kategori "${name}" dihapus`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Categories</h1>
          <p className="text-sm text-[#6b6f82] mt-0.5">Kelola kategori sound effect</p>
        </div>
        {editId !== 'new' && (
          <button onClick={startCreate} className="px-4 py-2 btn-accent text-sm rounded-xl hover:bg-accent-dim transition-colors">
            + Add Category
          </button>
        )}
      </div>

      {/* Form create/edit */}
      {editId && (
        <div className="card rounded-xl border border-rim p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#c4c6d8] mb-3">{editId === 'new' ? 'New Category' : 'Edit Category'}</h2>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[#6b6f82] mb-1">Name</label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: editId === 'new' ? slugify(e.target.value) : f.slug }))}
                className="w-full px-3 py-2 text-sm border border-rim rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. Nature"
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b6f82] mb-1">Slug</label>
              <input
                value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-rim rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. nature"
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b6f82] mb-1">Icon (emoji, optional)</label>
              <input
                value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-rim rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. 🌿"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 btn-accent text-sm rounded-lg hover:bg-accent-dim disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-[#6b6f82] hover:text-[#c4c6d8] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card rounded-xl border border-rim overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rim">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase">Icon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b6f82] uppercase">Sounds</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cats.map(cat => (
                <tr key={cat.id} className="border-b border-gray-50 last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-lg">{cat.icon || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{cat.name}</td>
                  <td className="px-4 py-3 text-sm text-[#6b6f82] font-mono">{cat.slug}</td>
                  <td className="px-4 py-3 text-sm text-[#6b6f82]">{cat._count.audioAssets}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(cat)} className="text-xs text-accent-bright hover:underline">Edit</button>
                      <button onClick={() => del(cat.id, cat.name)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {cats.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#6b6f82]">No categories yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
