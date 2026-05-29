// src/app/studio/page.tsx
'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { ordersApi } from '@/lib/api/orders';
import { formatDuration, formatPrice, formatDate, mediaUrl } from '@/lib/utils';
import { toast } from '@/lib/store/toast.store';
import { soundsApi } from '@/lib/api/sounds';
import { API_URL } from '@/lib/config';
import type { SoundEffect } from '@/types';

// ─── Constants ────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 input-dark rounded-xl text-sm';
const labelCls = 'block text-xs font-medium text-[#6b6f82] mb-1';

const REVIEW_STATUS: Record<string, { label: string; cls: string }> = {
  APPROVED:        { label: 'Live',            cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  PENDING:         { label: 'Pending Review',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  REJECTED:        { label: 'Rejected',        cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  NEEDS_RE_REVIEW: { label: 'Needs Re-review', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const MUSICAL_KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'];
const MOODS = ['upbeat','calm','epic','sad','dark','happy','neutral','tense','romantic','mysterious'];

const WITHDRAWAL_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Diproses',  cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  PAID:     { label: 'Selesai',   cls: 'bg-teal/10 text-teal border border-teal/20' },
  REJECTED: { label: 'Ditolak',  cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

// ─── Tab types ────────────────────────────────────────────

type StudioTab = 'sounds' | 'earnings' | 'analytics';

// ─── Analytics Bar ────────────────────────────────────────

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#5a5d72] w-8 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-white/[0.04] rounded-md overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#F7941D] to-[#00A79D] rounded-md transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[#6b6f82] w-8 flex-shrink-0">{value}</span>
    </div>
  );
}

// ─── Main Studio Page ─────────────────────────────────────

export default function StudioPage() {
  const { user, isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<StudioTab>('sounds');

  // Sounds state
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [editSound, setEditSound] = useState<SoundEffect | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', price: '0', accessLevel: 'FREE', categorySlug: '', tags: '', bpm: '', mood: '', musicalKey: '', hasStems: false });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setFormState] = useState({ title: '', categorySlug: '', description: '', price: '0', accessLevel: 'FREE', licenseType: 'personal', tags: '', bpm: '', mood: '', musicalKey: '', hasStems: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Earnings state
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Subscription cancel state
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, _hasHydrated, router]);

  // ── Queries ────────────────────────────────────────────

  const { data: soundsData, isLoading: loadingList } = useQuery({
    queryKey: ['my-sounds'],
    queryFn: async () => {
      const { data } = await apiClient.get('/sounds/mine');
      return (data.items ?? []) as SoundEffect[];
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/sounds/categories');
      return data as { slug: string; name: string; type: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionsApi.getMy,
    enabled: isAuthenticated,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: ordersApi.getMyOrders,
    enabled: isAuthenticated,
  });

  const { data: wallet, refetch: refetchWallet, isLoading: walletLoading } = useQuery<{ balance: number; totalEarned: number; withdrawals: any[] }>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/earnings/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok ? res.json() : { balance: 0, totalEarned: 0, withdrawals: [] };
    },
    enabled: isAuthenticated,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['creatorAnalytics'],
    queryFn: soundsApi.getCreatorAnalytics,
    enabled: isAuthenticated && activeTab === 'analytics',
  });

  const sounds = soundsData ?? [];
  const paidOrders = orders?.filter((o) => o.status === 'PAID') ?? [];

  if (!isAuthenticated || !user) return null;

  // ── Sound handlers ─────────────────────────────────────

  const fixDuration = async (sound: SoundEffect) => {
    setFixingId(sound.id);
    try {
      const { data } = await apiClient.post(`/sounds/${sound.id}/recalculate-duration`);
      if (data.durationMs > 0) {
        queryClient.setQueryData<SoundEffect[]>(['my-sounds'], prev =>
          prev?.map(s => s.id === sound.id ? { ...s, durationMs: data.durationMs } : s) ?? []);
      }
    } catch { toast.error('Gagal menghitung ulang durasi'); }
    finally { setFixingId(null); }
  };

  const openEdit = (sound: SoundEffect) => {
    setEditSound(sound); setEditError(null);
    setEditForm({
      title: sound.title, description: sound.description || '',
      price: String(sound.price ?? 0), accessLevel: sound.accessLevel || 'FREE',
      categorySlug: sound.category?.slug || '',
      tags: (sound.tags?.map((t: any) => t.tag?.slug ?? t.slug ?? t.name ?? t) ?? []).join(', '),
      bpm: sound.bpm ? String(sound.bpm) : '', mood: sound.mood || '',
      musicalKey: sound.musicalKey || '', hasStems: sound.hasStems ?? false,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editSound) return;
    setSaving(true); setEditError(null);
    try {
      const tagSlugs = editForm.tags.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      const body: any = {
        title: editForm.title.trim(), description: editForm.description,
        price: Number(editForm.price), accessLevel: editForm.accessLevel,
        categorySlug: editForm.categorySlug || editSound.category?.slug, tags: tagSlugs,
        bpm: editForm.bpm ? Number(editForm.bpm) : undefined,
        mood: editForm.mood || undefined, musicalKey: editForm.musicalKey || undefined,
        hasStems: editForm.hasStems,
      };
      const { data } = await apiClient.patch(`/sounds/${editSound.id}`, body);
      queryClient.setQueryData<SoundEffect[]>(['my-sounds'], prev =>
        prev?.map(s => s.id === editSound.id ? { ...s, ...data, tags: data.tags ?? s.tags } : s) ?? []);
      setEditSound(null); toast.success('Perubahan berhasil disimpan');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setEditError(Array.isArray(msg) ? msg.join(', ') : msg || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const setEdit = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [key]: e.target.value }));
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormState(f => ({ ...f, [key]: e.target.value }));

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!form.title) setFormState(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) handleFileSelect(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadError('Pilih file audio terlebih dahulu'); return; }
    if (!form.title.trim()) { setUploadError('Judul wajib diisi'); return; }
    if (!form.categorySlug) { setUploadError('Pilih kategori terlebih dahulu'); return; }
    setUploading(true); setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', form.title.trim());
      formData.append('categorySlug', form.categorySlug);
      formData.append('description', form.description);
      formData.append('price', form.price);
      formData.append('accessLevel', form.accessLevel);
      formData.append('licenseType', form.licenseType);
      if (form.tags.trim()) formData.append('tags', form.tags.trim());
      if (form.bpm) formData.append('bpm', form.bpm);
      if (form.mood) formData.append('mood', form.mood);
      if (form.musicalKey) formData.append('musicalKey', form.musicalKey);
      if (form.hasStems) formData.append('hasStems', 'true');
      const { data } = await apiClient.post('/sounds/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.setQueryData<SoundEffect[]>(['my-sounds'], prev => [data, ...(prev ?? [])]);
      setUploadSuccess(true); setShowModal(false);
      setFormState({ title: '', categorySlug: '', description: '', price: '0', accessLevel: 'FREE', licenseType: 'personal', tags: '', bpm: '', mood: '', musicalKey: '', hasStems: false });
      setSelectedFile(null);
      toast.success('Sound berhasil diupload! Menunggu review admin.');
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 413) setUploadError('File terlalu besar.');
      else setUploadError(Array.isArray(msg) ? msg.join(', ') : msg || 'Upload gagal. Coba lagi.');
    } finally { setUploading(false); }
  };

  // ── Earnings handlers ──────────────────────────────────

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 50000) { toast.error('Minimum penarikan Rp 50.000'); return; }
    if (amount > (wallet?.balance ?? 0)) { toast.error('Saldo tidak cukup'); return; }
    setWithdrawLoading(true);
    try {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/earnings/withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRp: amount }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Gagal mengajukan penarikan'); }
      toast.success('Permintaan penarikan berhasil diajukan');
      setShowWithdrawForm(false); setWithdrawAmount(''); refetchWallet();
    } catch (err: any) { toast.error(err.message || 'Gagal'); }
    finally { setWithdrawLoading(false); }
  };

  const sub = user.subscription;
  const subExpiresAt = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const liveCount = sounds.filter(s => s.reviewStatus === 'APPROVED').length;
  const pendingCount = sounds.filter(s => s.reviewStatus === 'PENDING' || s.reviewStatus === 'NEEDS_RE_REVIEW').length;
  const planColor = subscription?.plan.slug === 'pro' ? 'orange' : 'gray';

  const maxDownloads = Math.max(...(analyticsData?.monthlyDownloads?.map((d: any) => d.downloads) ?? [1]), 1);
  const maxSoundDownloads = Math.max(...(analyticsData?.topSounds?.map((s: any) => s.downloadCount) ?? [1]), 1);

  return (
    <div className="px-8 py-8 pb-28">

      {/* ── Confirm modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-lift rounded-2xl border border-rim w-full max-w-sm p-6 shadow-elevated">
            <p className="text-sm text-[#c4c6d8] mb-5 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-rim text-[#8b8fa8] hover:bg-white/[0.05] transition-colors">Tidak</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">Ya, batalkan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview Header ── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent-bright text-xl font-bold overflow-hidden ring-2 ring-accent/20 flex-shrink-0">
          {user.avatarUrl
            ? <img src={mediaUrl(user.avatarUrl) ?? ''} alt="avatar" className="w-full h-full object-cover" />
            : user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-sm text-[#5a5d72]">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#6b6f82] hover:text-white border border-rim hover:border-white/10 rounded-xl transition-all">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Profil
          </Link>
          <button
            onClick={() => { setShowModal(true); setUploadError(null); setUploadSuccess(false); setActiveTab('sounds'); }}
            className="flex items-center gap-1.5 px-4 py-1.5 btn-accent rounded-xl text-sm font-semibold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Upload Sound
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Sound Live', value: liveCount, color: 'text-teal-400' },
          { label: 'Pembelian', value: paidOrders.length, color: 'text-white' },
          { label: 'Total Earning', value: formatPrice(wallet?.totalEarned ?? 0), color: 'text-accent-bright' },
          { label: 'Saldo', value: formatPrice(wallet?.balance ?? 0), color: 'text-teal-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card rounded-2xl p-4">
            <p className="text-xs text-[#5a5d72] mb-1">{label}</p>
            <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Subscription card ── */}
      <div className="card rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${planColor === 'orange' ? 'bg-accent/20' : planColor === 'amber' ? 'bg-amber-500/20' : 'bg-white/[0.05]'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={planColor === 'orange' ? '#F7941D' : planColor === 'amber' ? '#f59e0b' : '#6b7280'}
                strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{subscription?.plan.name ?? 'Free'} Plan</p>
              {subscription?.status === 'ACTIVE' && subscription.plan.slug !== 'free' && (
                <p className="text-xs text-[#5a5d72]">Aktif sampai {formatDate(subscription.currentPeriodEnd)}</p>
              )}
            </div>
          </div>
          {subscription && !subscription.plan.unlimited && subscription.usage && (
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-[#5a5d72]">Download bulan ini</span>
                <span className="text-xs text-[#8b8fa8]">{subscription.usage.downloadsThisMonth} / {subscription.plan.downloadLimit}</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${subscription.usage.downloadsThisMonth / subscription.plan.downloadLimit > 0.8 ? 'bg-amber-500' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, (subscription.usage.downloadsThisMonth / subscription.plan.downloadLimit) * 100)}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {subscription?.plan.slug === 'free' && (
              <Link href="/pricing" className="px-3 py-1.5 text-xs font-medium btn-accent rounded-lg">Upgrade</Link>
            )}
            {subscription?.plan.slug !== 'free' && subscription?.status === 'ACTIVE' && (
              <button onClick={() => setConfirmModal({
                message: 'Batalkan subscription? Akses tetap aktif sampai akhir periode billing.',
                onConfirm: async () => {
                  try {
                    const token = accessToken || sessionStorage.getItem('accessToken');
                    const res = await fetch(`${API_URL}/subscriptions/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                    if (res.ok) { queryClient.invalidateQueries({ queryKey: ['subscription'] }); toast.success('Subscription dibatalkan.'); }
                    else toast.error('Gagal membatalkan subscription');
                  } catch { toast.error('Gagal membatalkan subscription'); }
                },
              })}
                className="px-3 py-1.5 text-xs border border-rim text-[#6b6f82] hover:text-red-400 hover:border-red-500/30 rounded-lg transition-colors"
              >Batalkan</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex items-center gap-1 border-b border-[#1a1b2e] mb-6">
        {([
          { id: 'sounds', label: 'Sounds', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
          { id: 'earnings', label: 'Earnings', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
          { id: 'analytics', label: 'Analytics', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
        ] as { id: StudioTab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-accent text-accent-bright'
                : 'border-transparent text-[#5a5d72] hover:text-[#c4c6d8]'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-accent-bright' : 'text-[#3a3c4e]'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Tab: Sounds ── */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'sounds' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Sound', value: sounds.length, color: 'text-white', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8fa8" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
              { label: 'Live', value: liveCount, color: 'text-teal-400', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A79D" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
              { label: 'Menunggu Review', value: pendingCount, color: 'text-amber-400', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="card rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-xs text-[#5a5d72] mb-0.5">{label}</p>
                  <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {uploadSuccess && (
            <div className="mb-4 px-4 py-3 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm rounded-xl flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Sound berhasil diupload! Menunggu review admin.
            </div>
          )}

          {sounds.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[11px] font-bold text-[#5a5d72] uppercase tracking-[0.12em]">Sound Kamu ({sounds.length})</h2>
              <div className="flex-1 h-px bg-[#1e2030]" />
            </div>
          )}

          {loadingList ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-[72px] rounded-xl bg-[#0f1020] border border-[#1e2030] animate-pulse" />)}</div>
          ) : sounds.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-[#1e2030]">
              <div className="w-14 h-14 rounded-2xl bg-accent/[0.08] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <p className="text-base font-semibold text-white">Belum ada sound</p>
              <p className="text-sm text-[#5a5d72] mt-1 mb-5">Upload sound pertama kamu dan mulai earning</p>
              <button onClick={() => setShowModal(true)} className="px-5 py-2.5 btn-accent rounded-xl text-sm font-semibold">Upload Sekarang</button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1e2030] overflow-hidden">
              {sounds.map((sound, idx) => {
                const status = REVIEW_STATUS[sound.reviewStatus || 'PENDING'] ?? REVIEW_STATUS.PENDING;
                return (
                  <div key={sound.id}>
                    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors ${idx > 0 ? 'border-t border-[#1a1b2e]' : ''} ${sound.reviewStatus === 'REJECTED' ? 'border-l-2 border-l-red-500/40' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-accent/[0.08] border border-accent/[0.12] flex items-center justify-center flex-shrink-0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F7941D" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{sound.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-[#5a5d72]">{sound.category?.name}</span>
                          <span className="text-[#2a2c3e]">·</span>
                          <span className="text-xs text-[#3a3c4e] font-mono uppercase">{sound.format}</span>
                          <span className="text-[#2a2c3e]">·</span>
                          <span className="text-xs text-[#3a3c4e]">{formatDuration(sound.durationMs)}</span>
                          {sound.durationMs === 0 && (
                            <button onClick={() => fixDuration(sound)} disabled={fixingId === sound.id} className="text-amber-400 hover:underline text-[11px] ml-0.5">
                              {fixingId === sound.id ? 'memproses...' : 'fix durasi'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="hidden lg:flex items-center gap-6 text-xs flex-shrink-0">
                        <div className="text-center"><p className="text-[#c4c6d8] font-semibold">{sound.playCount.toLocaleString()}</p><p className="text-[#3a3c4e] text-[10px] mt-0.5">plays</p></div>
                        <div className="text-center"><p className="text-[#c4c6d8] font-semibold">{sound.downloadCount.toLocaleString()}</p><p className="text-[#3a3c4e] text-[10px] mt-0.5">downloads</p></div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${status.cls}`}>{status.label}</span>
                        <button onClick={() => openEdit(sound)} className="w-8 h-8 rounded-lg border border-[#1e2030] text-[#5a5d72] hover:text-white hover:border-[#2a2c3e] flex items-center justify-center transition-all">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                    </div>
                    {sound.reviewStatus === 'REJECTED' && sound.reviewNote && (
                      <div className="px-5 pb-3 -mt-1 border-t border-[#1a1b2e]">
                        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">
                          <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <p className="text-xs text-red-400"><span className="font-medium">Alasan penolakan: </span>{sound.reviewNote}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Tab: Earnings ── */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'earnings' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-2xl">
            <div className="card rounded-2xl p-5">
              <p className="text-xs text-[#5a5d72] mb-2">Saldo Tersedia</p>
              <p className="text-2xl font-bold text-teal-400">{formatPrice(wallet?.balance ?? 0)}</p>
              <button
                onClick={() => setShowWithdrawForm(!showWithdrawForm)}
                disabled={(wallet?.balance ?? 0) < 50000}
                className="mt-3 w-full py-2 text-xs font-semibold btn-accent rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Tarik Dana
              </button>
            </div>
            <div className="card rounded-2xl p-5">
              <p className="text-xs text-[#5a5d72] mb-2">Total Diperoleh</p>
              <p className="text-2xl font-bold text-accent-bright">{formatPrice(wallet?.totalEarned ?? 0)}</p>
              <p className="text-xs text-[#3a3c4e] mt-3">Sepanjang waktu</p>
            </div>
          </div>

          {showWithdrawForm && (
            <div className="card rounded-2xl p-5 mb-5 border border-accent/20 max-w-2xl">
              <p className="text-sm font-semibold text-white mb-3">Ajukan Penarikan</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5a5d72]">Rp</span>
                  <input type="number" min="50000" max={wallet?.balance ?? 0} value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)} placeholder="Jumlah (min. 50.000)"
                    className="w-full pl-9 pr-3 py-2.5 input-dark rounded-xl text-sm" />
                </div>
                <button onClick={handleWithdraw} disabled={withdrawLoading} className="px-5 py-2.5 text-sm font-semibold btn-accent rounded-xl disabled:opacity-50">
                  {withdrawLoading ? 'Memproses...' : 'Ajukan'}
                </button>
                <button onClick={() => setShowWithdrawForm(false)} className="px-3 py-2.5 text-sm border border-rim text-[#6b6f82] rounded-xl hover:bg-white/[0.04]">Batal</button>
              </div>
              <p className="text-xs text-[#3a3c4e] mt-2">
                Dana ke rekening bank yang terdaftar di{' '}
                <Link href="/profile" className="text-accent-bright hover:underline">profil kamu</Link>.
              </p>
            </div>
          )}

          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-white mb-3">Riwayat Penarikan</p>
            {walletLoading ? (
              <div className="h-24 card rounded-2xl animate-pulse" />
            ) : !wallet?.withdrawals?.length ? (
              <div className="card rounded-2xl py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6f82" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <p className="text-sm text-[#6b6f82]">Belum ada penarikan</p>
                <p className="text-xs text-[#3a3c4e] mt-1">Upload sound & mulai earning dulu</p>
              </div>
            ) : (
              <div className="card rounded-2xl divide-y divide-white/[0.05] overflow-hidden">
                {wallet.withdrawals.map((wd: any) => {
                  const st = WITHDRAWAL_STATUS[wd.status] ?? WITHDRAWAL_STATUS.PENDING;
                  return (
                    <div key={wd.id} className="flex items-center gap-4 px-5 py-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${wd.status === 'PAID' ? 'bg-teal/10' : wd.status === 'REJECTED' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={wd.status === 'PAID' ? '#00A79D' : wd.status === 'REJECTED' ? '#f87171' : '#fbbf24'}
                          strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white">{formatPrice(wd.amountRp)}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                        </div>
                        <p className="text-xs text-[#5a5d72]">{wd.bankName} · {wd.accountNo}</p>
                      </div>
                      <p className="text-xs text-[#3a3c4e] flex-shrink-0">{new Date(wd.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Tab: Analytics ── */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <>
          <p className="text-sm text-[#5a5d72] mb-5">Performa sound kamu dalam 6 bulan terakhir</p>
          {analyticsLoading ? (
            <div className="space-y-4">{Array(2).fill(0).map((_, i) => <div key={i} className="h-32 card rounded-2xl animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="card rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-5">Download per Bulan</h2>
                <div className="space-y-3">
                  {analyticsData?.monthlyDownloads?.map((item: any) => (
                    <Bar key={item.month} value={item.downloads} max={maxDownloads} label={item.label} />
                  ))}
                </div>
                <p className="text-xs text-[#3a3c4e] mt-4">
                  Total: <span className="text-[#6b6f82]">{analyticsData?.monthlyDownloads?.reduce((s: number, d: any) => s + d.downloads, 0) ?? 0} downloads</span> dalam 6 bulan
                </p>
              </div>
              <div className="card rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-5">Sound Terpopuler</h2>
                {!analyticsData?.topSounds?.length ? (
                  <div className="text-center py-8"><p className="text-sm text-[#5a5d72]">Belum ada sound yang diupload</p></div>
                ) : (
                  <div className="space-y-4">
                    {analyticsData.topSounds.map((sound: any, i: number) => (
                      <div key={sound.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#3a3c4e] w-6 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#c4c6d8] truncate font-medium">{sound.title}</p>
                          <div className="mt-1.5 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#00A79D] to-cyan-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((sound.downloadCount / maxSoundDownloads) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-[#c4c6d8] font-semibold">{sound.downloadCount}</p>
                          <p className="text-[11px] text-[#3a3c4e]">{sound.playCount} plays</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Edit Sound Modal ── */}
      {editSound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card-lift rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-rim shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Edit Sound</h2>
              <button onClick={() => setEditSound(null)} className="text-[#4a4d5e] hover:text-[#8b8fa8] text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div><label className={labelCls}>Judul *</label><input type="text" value={editForm.title} onChange={setEdit('title')} required className={inputCls} /></div>
              <div>
                <label className={labelCls}>Kategori *</label>
                <select value={editForm.categorySlug} onChange={setEdit('categorySlug')} required className={`${inputCls} bg-lift`}>
                  <option value="" disabled>Pilih Kategori...</option>
                  {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Deskripsi</label><textarea value={editForm.description} onChange={setEdit('description')} rows={2} className={`${inputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Akses</label>
                  <select value={editForm.accessLevel} onChange={setEdit('accessLevel')} className={`${inputCls} bg-lift`}>
                    <option value="FREE">Free</option><option value="PRO">Pro</option><option value="PURCHASE">Purchase</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Harga (Rp)</label>
                  <input type="number" value={editForm.price} onChange={setEdit('price')} min="0" step="1000" disabled={editForm.accessLevel === 'FREE'} className={`${inputCls} disabled:opacity-40`} />
                </div>
              </div>
              <div><label className={labelCls}>Tags</label><input type="text" value={editForm.tags} onChange={setEdit('tags')} placeholder="impact, metal, heavy" className={inputCls} /></div>
              {categories.find(c => c.slug === (editForm.categorySlug || editSound?.category?.slug))?.type === 'music' && (
                <div className="space-y-3 pt-1 border-t border-rim">
                  <p className="text-xs font-semibold text-accent-bright">Detail Musik</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>BPM</label><input type="number" value={editForm.bpm} onChange={setEdit('bpm')} min="1" max="300" placeholder="120" className={inputCls} /></div>
                    <div>
                      <label className={labelCls}>Nada</label>
                      <select value={editForm.musicalKey} onChange={setEdit('musicalKey')} className={`${inputCls} bg-lift`}>
                        <option value="">— Pilih —</option>
                        {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Mood</label>
                    <select value={editForm.mood} onChange={setEdit('mood')} className={`${inputCls} bg-lift`}>
                      <option value="">— Pilih —</option>
                      {MOODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={editForm.hasStems} onChange={e => setEditForm(f => ({ ...f, hasStems: e.target.checked }))} className="w-4 h-4 rounded accent-orange-500" />
                    <span className="text-sm text-[#c4c6d8]">Termasuk stems / track terpisah</span>
                  </label>
                </div>
              )}
              {editForm.accessLevel !== 'FREE' && <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">Mengubah harga atau akses akan mereset status review ke Pending.</p>}
              {editError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditSound(null)} className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</> : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card-lift rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-rim shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Upload Sound Effect</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4a4d5e] hover:text-[#8b8fa8] text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${selectedFile ? 'border-accent/60 bg-accent/[0.08]' : 'border-rim hover:border-accent/40 hover:bg-accent/[0.05]'}`}>
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
                {selectedFile ? (
                  <div><p className="text-sm font-medium text-accent-bright">{selectedFile.name}</p><p className="text-xs text-[#6b6f82] mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p></div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-[#3a3c4e] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p className="text-sm text-[#6b6f82]">Drag & drop atau <span className="text-accent-bright">pilih file audio</span></p>
                    <p className="text-xs text-[#4a4d5e] mt-1">WAV, MP3, OGG, FLAC · Maks 100MB</p>
                  </div>
                )}
              </div>
              <div><label className={labelCls}>Judul *</label><input type="text" value={form.title} onChange={set('title')} required placeholder="cth. Heavy Metal Impact" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Kategori *</label>
                <select value={form.categorySlug} onChange={set('categorySlug')} required className={`${inputCls} bg-lift`}>
                  <option value="" disabled>Pilih Kategori...</option>
                  {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Deskripsi</label><textarea value={form.description} onChange={set('description')} rows={2} placeholder="Deskripsi singkat sound..." className={`${inputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Akses</label>
                  <select value={form.accessLevel} onChange={set('accessLevel')} className={`${inputCls} bg-lift`}>
                    <option value="FREE">Free</option><option value="PRO">Pro</option><option value="PURCHASE">Purchase</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Harga (Rp)</label>
                  <input type="number" value={form.price} onChange={set('price')} min="0" step="1000" disabled={form.accessLevel === 'FREE'} placeholder="0" className={`${inputCls} disabled:opacity-40`} />
                </div>
              </div>
              <div><label className={labelCls}>Tags</label><input type="text" value={form.tags} onChange={set('tags')} placeholder="impact, metal, heavy, sfx" className={inputCls} /></div>
              {categories.find(c => c.slug === form.categorySlug)?.type === 'music' && (
                <div className="space-y-3 pt-1 border-t border-rim">
                  <p className="text-xs font-semibold text-accent-bright">Detail Musik</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>BPM</label><input type="number" value={form.bpm} onChange={set('bpm')} min="1" max="300" placeholder="120" className={inputCls} /></div>
                    <div>
                      <label className={labelCls}>Nada</label>
                      <select value={form.musicalKey} onChange={set('musicalKey')} className={`${inputCls} bg-lift`}>
                        <option value="">— Pilih —</option>
                        {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Mood</label>
                    <select value={form.mood} onChange={set('mood')} className={`${inputCls} bg-lift`}>
                      <option value="">— Pilih —</option>
                      {MOODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.hasStems} onChange={e => setFormState(f => ({ ...f, hasStems: e.target.checked }))} className="w-4 h-4 rounded accent-orange-500" />
                    <span className="text-sm text-[#c4c6d8]">Termasuk stems / track terpisah</span>
                  </label>
                </div>
              )}
              {uploadError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{uploadError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium">Batal</button>
                <button type="submit" disabled={uploading} className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Mengupload...</> : 'Upload Sound'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
