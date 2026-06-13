'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';


interface Tag { id: string; name: string; slug: string; _count: { audioAssets: number } }

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminTagsPage() {
  const { accessToken } = useAuthStore();
  const token = () => accessToken || sessionStorage.getItem('accessToken') || '';

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API}/admin/tags`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setTags(Array.isArray(d) ? d : d.items ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name required'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API}/admin/tags`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), slug: form.slug || slugify(form.name) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      setForm({ name: '', slug: '' });
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? It will be removed from all sounds.`)) return;
    await fetch(`${API}/admin/tags/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    load();
  };

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Tags</h1>
        <p className="text-sm text-[#6b6f82] mt-0.5">Manage tags for sound effects</p>
      </div>

      {/* Add form */}
      <form onSubmit={create} className="card rounded-xl border border-rim p-4 mb-4">
        <h2 className="text-sm font-semibold text-[#c4c6d8] mb-3">Add New Tag</h2>
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex gap-3">
          <input
            value={form.name} onChange={e => setForm({ name: e.target.value, slug: slugify(e.target.value) })}
            placeholder="Tag name (e.g. Ambient)"
            className="flex-1 px-3 py-2 text-sm border border-rim rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
            placeholder="slug (auto)"
            className="w-40 px-3 py-2 text-sm border border-rim rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="submit" disabled={saving} className="px-4 py-2 btn-accent text-sm rounded-lg hover:bg-accent-dim disabled:opacity-50 transition-colors">
            {saving ? '...' : '+ Add'}
          </button>
        </div>
      </form>

      {/* Search + list */}
      <div className="card rounded-xl border border-rim overflow-hidden">
        <div className="px-4 py-3 border-b border-rim">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full text-sm focus:outline-none text-[#c4c6d8] placeholder-gray-400"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(tag => (
              <div key={tag.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{tag.name}</span>
                  <span className="text-xs text-[#6b6f82] font-mono">#{tag.slug}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#6b6f82]">{tag._count.audioAssets} sounds</span>
                  <button onClick={() => del(tag.id, tag.name)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[#6b6f82]">No tags found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
