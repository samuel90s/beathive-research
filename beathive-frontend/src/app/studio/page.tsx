// src/app/studio/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { formatDuration } from '@/lib/utils';
import { API_URL } from '@/lib/config';
import { toast } from '@/lib/store/toast.store';
import type { SoundEffect } from '@/types';

interface Earning { id: string; soundTitle: string; amountRp: number; earnedAt: string; }
interface Withdrawal { id: string; amountRp: number; status: string; bankName: string; accountNo: string; note?: string; createdAt: string; }
interface WalletData { balance: number; totalEarned: number; earnings: Earning[]; withdrawals: Withdrawal[]; }

const inputCls = 'w-full px-3 py-2 input-dark rounded-xl text-sm';
const labelCls = 'block text-xs font-medium text-[#6b6f82] mb-1';
const cardCls = 'card rounded-2xl p-5';

export default function StudioPage() {
  const { user, isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
  const router = useRouter();

  const [tab, setTab] = useState<'sounds' | 'earnings' | 'analytics'>('sounds');
  const [sounds, setSounds] = useState<SoundEffect[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [editSound, setEditSound] = useState<SoundEffect | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', price: '0', accessLevel: 'FREE', categorySlug: '', tags: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: '', categorySlug: '', description: '', price: '0', accessLevel: 'FREE', licenseType: 'personal', tags: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    fetchMySounds();
    fetchWallet();
    fetchCategories();
  }, [isAuthenticated, _hasHydrated]);

  const fetchCategories = async () => {
    const res = await fetch(`${API_URL}/sounds/categories`);
    if (res.ok) setCategories(await res.json());
  };

  const fetchWallet = async () => {
    const token = accessToken || sessionStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/earnings/wallet`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setWallet(await res.json());
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/earnings/withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRp: Number(withdrawAmount) }),
      });
      if (res.status === 401 || res.status === 403) { router.push('/auth/login'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setWithdrawMsg('success:Withdrawal request submitted! Admin will process within 1–3 business days.');
      setWithdrawAmount('');
      fetchWallet();
    } catch (err: any) {
      setWithdrawMsg(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const fetchMySounds = async () => {
    setLoadingList(true);
    try {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/sounds/mine`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setSounds(data.items || []); }
    } catch { toast.error('Failed to load sounds. Try refreshing the page.'); }
    finally { setLoadingList(false); }
  };

  const fixDuration = async (sound: SoundEffect) => {
    setFixingId(sound.id);
    try {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/sounds/${sound.id}/recalculate-duration`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.durationMs > 0) setSounds((prev) => prev.map((s) => s.id === sound.id ? { ...s, durationMs: data.durationMs } : s));
      }
    } catch { toast.error('Failed to recalculate duration'); }
    finally { setFixingId(null); }
  };

  const openEdit = (sound: SoundEffect) => {
    setEditSound(sound);
    setEditError(null);
    setEditForm({ title: sound.title, description: sound.description || '', price: String(sound.price ?? 0), accessLevel: sound.accessLevel || 'FREE', categorySlug: sound.category?.slug || '', tags: (sound.tags?.map((t: any) => t.tag?.slug ?? t.slug ?? t.name ?? t) ?? []).join(', ') });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSound) return;
    setSaving(true); setEditError(null);
    try {
      const token = accessToken || sessionStorage.getItem('accessToken');
      const tagSlugs = editForm.tags.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      const body: any = { title: editForm.title.trim(), description: editForm.description, price: Number(editForm.price), accessLevel: editForm.accessLevel, categorySlug: editForm.categorySlug || editSound.category?.slug, tags: tagSlugs };
      const res = await fetch(`${API_URL}/sounds/${editSound.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Failed to save');
      setSounds((prev) => prev.map((s) => s.id === editSound.id ? { ...s, ...data, tags: data.tags ?? s.tags } : s));
      setEditSound(null);
      toast.success('Changes saved successfully');
    } catch (err: any) { setEditError(err.message); }
    finally { setSaving(false); }
  };

  const setEdit = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setEditForm((f) => ({ ...f, [key]: e.target.value }));
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('audio/')) handleFileSelect(file); };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadError('Please select an audio file'); return; }
    if (!form.title.trim()) { setUploadError('Title is required'); return; }
    if (!form.categorySlug) { setUploadError('Please select a category'); return; }

    setUploading(true); setUploadError(null); setUploadProgress('Uploading file...');
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

      const token = accessToken || sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/sounds/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      if (!res.ok) {
        if (res.status === 413) throw new Error('File is too large. Reduce the file size and try again.');
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        if (res.status === 400) throw new Error(err.message || 'Invalid data. Please check the form and try again.');
        if (res.status === 401 || res.status === 403) throw new Error('Your session expired. Please log in again.');
        throw new Error(err.message || 'Upload failed. Please try again.');
      }
      const data = await res.json();
      setSounds((prev) => [data, ...prev]);
      setUploadSuccess(true);
      setShowModal(false);
      setForm({ title: '', categorySlug: '', description: '', price: '0', accessLevel: 'FREE', licenseType: 'personal', tags: '' });
      setSelectedFile(null);
      toast.success('Sound uploaded! Awaiting admin review.');
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err: any) { setUploadError(err.message || 'Upload failed'); }
    finally { setUploading(false); setUploadProgress(''); }
  };

  if (!isAuthenticated || !user) return null;

  const sub = user.subscription;
  const subExpiresAt = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const subExpiresSoon = subExpiresAt && sub?.plan?.slug !== 'free' && subExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && subExpiresAt > new Date();
  const subExpired = subExpiresAt && sub?.plan?.slug !== 'free' && sub?.status !== 'ACTIVE';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {(subExpiresSoon || subExpired) && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 border ${subExpired ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${subExpired ? 'text-red-400' : 'text-amber-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className={`text-sm font-medium ${subExpired ? 'text-red-400' : 'text-amber-400'}`}>
              {subExpired ? 'Subscription expired' : `Subscription expires ${subExpiresAt!.toLocaleDateString('en-GB')}`}
            </p>
            <p className={`text-xs mt-0.5 ${subExpired ? 'text-red-400/80' : 'text-amber-400/80'}`}>
              {subExpired ? 'PRO/Business downloads are unavailable. ' : 'Renew before it expires. '}
              <a href="/pricing" className="underline font-medium">View plans</a>
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Studio</h1>
          <p className="text-sm text-[#6b6f82] mt-0.5">Manage and upload your sound effects</p>
        </div>
        {tab === 'sounds' && (
          <button
            onClick={() => { setShowModal(true); setUploadError(null); setUploadSuccess(false); }}
            className="flex items-center gap-2 px-4 py-2 btn-accent rounded-xl text-sm font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Upload Sound
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-white/[0.04] p-1 rounded-xl w-fit border border-rim">
        {(['sounds', 'earnings', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
              tab === t ? 'bg-white/[0.08] text-white shadow-sm' : 'text-[#6b6f82] hover:text-[#c4c6d8]'
            }`}
          >
            {t === 'earnings' ? 'Earnings' : t === 'analytics' ? 'Analytics' : 'My Sounds'}
            {t === 'earnings' && wallet && wallet.balance > 0 && (
              <span className="text-[10px] bg-teal/15 text-teal border border-teal/20 px-1.5 py-0.5 rounded-full font-semibold">
                Rp {wallet.balance.toLocaleString('id-ID')}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Earnings Tab ─── */}
      {tab === 'earnings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={cardCls}>
              <p className="text-xs text-[#6b6f82] mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-accent-bright">Rp {(wallet?.balance ?? 0).toLocaleString('id-ID')}</p>
              <p className="text-xs text-[#5a5d72] mt-1">Min. withdrawal Rp 50.000</p>
            </div>
            <div className={cardCls}>
              <p className="text-xs text-[#6b6f82] mb-1">Total Earned (All Time)</p>
              <p className="text-2xl font-bold text-white">Rp {(wallet?.totalEarned ?? 0).toLocaleString('id-ID')}</p>
              <p className="text-xs text-[#5a5d72] mt-1">Per-item: 70% · PRO pool: 25%</p>
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-white mb-1">Request Withdrawal</h3>
            {!user.bankName || !user.bankAccount ? (
              <div className="mt-3 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <p className="text-sm text-amber-400 font-medium">Bank account not set</p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Add your bank account in{' '}
                    <a href="/profile" className="underline font-medium">Profile Settings</a>
                    {' '}before requesting a withdrawal.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mt-2 mb-4 px-3 py-2 bg-white/[0.04] rounded-xl border border-rim">
                  <svg className="w-4 h-4 text-[#5a5d72]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  <span className="text-sm text-[#8b8fa8]">{user.bankName} · {user.bankAccount}</span>
                  <a href="/profile" className="ml-auto text-xs text-accent-bright hover:underline">Change</a>
                </div>
                <form onSubmit={handleWithdraw} className="space-y-3">
                  <div>
                    <label className={labelCls}>Amount (Rp)</label>
                    <input type="number" min="50000" step="10000" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="50000" className={inputCls} required />
                  </div>
                  {withdrawMsg && (
                    <p className={`text-xs px-3 py-2 rounded-lg ${withdrawMsg.startsWith('success:') ? 'bg-teal/10 text-teal border border-teal/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {withdrawMsg.replace('success:', '')}
                    </p>
                  )}
                  <button type="submit" disabled={withdrawing || (wallet?.balance ?? 0) < 50000}
                    className="w-full py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-40">
                    {withdrawing ? 'Processing...' : `Withdraw Rp ${(wallet?.balance ?? 0).toLocaleString('id-ID')}`}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-white mb-3">Earning History</h3>
            {!wallet?.earnings.length ? (
              <p className="text-sm text-[#5a5d72] text-center py-4">No earnings yet. Upload sounds and wait for purchases or downloads!</p>
            ) : (
              <div className="space-y-1">
                {wallet.earnings.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2.5 border-b border-rim last:border-0">
                    <div>
                      <p className="text-sm text-[#c4c6d8] truncate max-w-xs">{e.soundTitle}</p>
                      <p className="text-xs text-[#5a5d72]">{new Date(e.earnedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <span className="text-sm font-semibold text-teal">+Rp {e.amountRp.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-white mb-3">Withdrawal History</h3>
            {!wallet?.withdrawals.length ? (
              <p className="text-sm text-[#5a5d72] text-center py-4">No withdrawal requests yet.</p>
            ) : (
              <div className="space-y-1">
                {wallet.withdrawals.map(w => {
                  const statusCls = w.status === 'PAID' ? 'bg-teal/10 text-teal border-teal/20' : w.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  return (
                    <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-rim last:border-0">
                      <div>
                        <p className="text-sm text-[#c4c6d8]">{w.bankName} · {w.accountNo}</p>
                        <p className="text-xs text-[#5a5d72]">{new Date(w.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        {w.note && !w.note.startsWith('Account holder:') && <p className="text-xs text-red-400 mt-0.5">{w.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#c4c6d8]">Rp {w.amountRp.toLocaleString('id-ID')}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${statusCls}`}>{w.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Analytics Tab ─── */}
      {tab === 'analytics' && <AnalyticsTab accessToken={accessToken} />}

      {/* ─── Sounds Tab ─── */}
      {uploadSuccess && tab === 'sounds' && (
        <div className="mb-4 px-4 py-3 bg-teal/10 border border-teal/20 text-teal text-sm rounded-xl flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Sound uploaded successfully!
        </div>
      )}

      {tab === 'sounds' && (loadingList ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sounds.length === 0 ? (
        <div className="text-center py-20 card rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <p className="text-[#c4c6d8] font-medium">No sounds yet</p>
          <p className="text-sm text-[#5a5d72] mt-1">Upload your first sound effect</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 btn-accent rounded-xl text-sm font-medium">Upload Now</button>
        </div>
      ) : (
        <div className="space-y-2">
          {sounds.map((sound) => {
            const reviewStatus = sound.reviewStatus || 'PENDING';
            const isRejected = reviewStatus === 'REJECTED';
            const isNeedsReReview = reviewStatus === 'NEEDS_RE_REVIEW';
            const statusCls = reviewStatus === 'APPROVED'
              ? 'bg-teal/10 text-teal border-teal/20'
              : isRejected
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : isNeedsReReview
              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            const statusLabel = reviewStatus === 'APPROVED'
              ? 'Live'
              : isRejected
              ? 'Rejected'
              : isNeedsReReview
              ? 'Needs Re-review'
              : 'Pending Review';
            return (
              <div key={sound.id} className={`card rounded-xl px-4 py-3 ${isRejected ? 'border-red-500/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#c4c6d8] truncate">{sound.title}</p>
                    <p className="text-xs text-[#5a5d72]">
                      {sound.category?.name} · {sound.format?.toUpperCase()} · {formatDuration(sound.durationMs)}
                      {' · '}{sound.playCount} plays · {sound.downloadCount} downloads
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                    <button onClick={() => openEdit(sound)} className="text-[#3a3c4e] hover:text-accent-bright transition-colors flex-shrink-0" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {isRejected && sound.reviewNote && (
                  <div className="mt-2 flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-xs text-red-400"><span className="font-medium">Reason: </span>{sound.reviewNote}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* ─── Edit Modal ─── */}
      {editSound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card-lift rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-rim shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Edit Sound Effect</h2>
              <button onClick={() => setEditSound(null)} className="text-[#4a4d5e] hover:text-[#8b8fa8] text-xl leading-none transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div><label className={labelCls}>Title *</label><input type="text" value={editForm.title} onChange={setEdit('title')} required className={inputCls} /></div>
              <div>
                <label className={labelCls}>Category *</label>
                <select value={editForm.categorySlug} onChange={setEdit('categorySlug')} required className={`${inputCls} bg-lift`}>
                  <option value="" disabled>Select Category...</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Description</label><textarea value={editForm.description} onChange={setEdit('description')} rows={2} className={`${inputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Access</label>
                  <select value={editForm.accessLevel} onChange={setEdit('accessLevel')} className={`${inputCls} bg-lift`}>
                    <option value="FREE">Free</option><option value="PRO">Pro</option><option value="PURCHASE">Purchase</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Price (Rp) {editForm.accessLevel === 'FREE' && <span className="text-[#4a4d5e]">— not needed</span>}</label>
                  <input type="number" value={editForm.price} onChange={setEdit('price')} min="0" step="1000" disabled={editForm.accessLevel === 'FREE'} className={`${inputCls} disabled:opacity-40`} />
                </div>
              </div>
              <div><label className={labelCls}>Tags <span className="text-[#4a4d5e]">(separate with commas)</span></label><input type="text" value={editForm.tags} onChange={setEdit('tags')} placeholder="impact, metal, heavy, sfx" className={inputCls} /></div>
              {editForm.accessLevel !== 'FREE' && <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">Changing price or access will reset the review status to Pending Review.</p>}
              {editError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditSound(null)} className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Upload Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card-lift rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 border border-rim shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Upload Sound Effect</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4a4d5e] hover:text-[#8b8fa8] text-xl leading-none transition-colors">&times;</button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  selectedFile ? 'border-accent/60 bg-accent/8' : 'border-rim hover:border-accent/40 hover:bg-accent/5'
                }`}
                style={selectedFile ? { backgroundColor: 'rgba(139,92,246,0.08)' } : undefined}
              >
                <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-accent-bright">{selectedFile.name}</p>
                    <p className="text-xs text-[#6b6f82] mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-[#3a3c4e] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="text-sm text-[#6b6f82]">Drag & drop or <span className="text-accent-bright">select audio file</span></p>
                    <p className="text-xs text-[#4a4d5e] mt-1">WAV, MP3, OGG, FLAC · Max 100MB</p>
                  </div>
                )}
              </div>

              <div><label className={labelCls}>Title *</label><input type="text" value={form.title} onChange={set('title')} required placeholder="e.g. Heavy Metal Impact" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Category *</label>
                <select value={form.categorySlug} onChange={set('categorySlug')} required className={`${inputCls} bg-lift`}>
                  <option value="" disabled>Select Category...</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Description</label><textarea value={form.description} onChange={set('description')} rows={2} placeholder="Short sound description..." className={`${inputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Access</label>
                  <select value={form.accessLevel} onChange={set('accessLevel')} className={`${inputCls} bg-lift`}>
                    <option value="FREE">Free</option><option value="PRO">Pro</option><option value="PURCHASE">Purchase</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Price (Rp) {form.accessLevel === 'FREE' && <span className="text-[#4a4d5e]">— not needed</span>}</label>
                  <input type="number" value={form.price} onChange={set('price')} min="0" step="1000" disabled={form.accessLevel === 'FREE'} placeholder="0" className={`${inputCls} disabled:opacity-40`} />
                </div>
              </div>
              <div><label className={labelCls}>Tags <span className="text-[#4a4d5e]">(separate with commas)</span></label><input type="text" value={form.tags} onChange={set('tags')} placeholder="impact, metal, heavy, sfx" className={inputCls} /></div>

              {uploadError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{uploadError}</p>}
              {uploadProgress && <p className="text-xs text-accent-bright bg-accent/10 border border-accent/20 px-3 py-2 rounded-lg">{uploadProgress}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" disabled={uploading || !selectedFile} className="flex-1 py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</> : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────

interface MonthlyPoint { month: string; totalRp: number; downloadCount: number; }
interface TopSound { soundId: string; title: string; slug: string; earnings: number; downloads: number; }

function AnalyticsTab({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<{ monthlyEarnings: MonthlyPoint[]; topSounds: TopSound[]; totalThisMonth: number; totalLastMonth: number; trend: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null);
    fetch(`${API_URL}/earnings/analytics?months=12`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <p className="text-center text-[#5a5d72] py-8">No analytics data yet.</p>;

  const maxRp = Math.max(...data.monthlyEarnings.map(m => m.totalRp), 1);
  const trendColor = data.trend === 'up' ? 'text-teal' : data.trend === 'down' ? 'text-red-400' : 'text-[#6b6f82]';
  const trendLabel = data.trend === 'up' ? '▲ Up' : data.trend === 'down' ? '▼ Down' : '— Flat';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'This Month', value: `Rp ${data.totalThisMonth.toLocaleString('id-ID')}`, cls: 'text-accent-bright' },
          { label: 'Last Month', value: `Rp ${data.totalLastMonth.toLocaleString('id-ID')}`, cls: 'text-[#c4c6d8]' },
          { label: 'Trend', value: trendLabel, cls: trendColor },
        ].map((s) => (
          <div key={s.label} className="card rounded-2xl p-4">
            <p className="text-xs text-[#6b6f82] mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Monthly Earnings (12 months)</h3>
        <div className="flex items-end gap-1 h-32">
          {data.monthlyEarnings.map(m => {
            const pct = maxRp > 0 ? (m.totalRp / maxRp) * 100 : 0;
            const [, mon] = m.month.split('-');
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.month}: Rp ${m.totalRp.toLocaleString('id-ID')}`}>
                <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className="w-full bg-accent/50 hover:bg-accent rounded-t transition-all"
                    style={{ height: `${Math.max(pct, m.totalRp > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-[9px] text-[#4a4d5e]">{monthNames[parseInt(mon, 10) - 1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {data.topSounds.length > 0 && (
        <div className="card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Top Sounds by Earnings</h3>
          <div className="space-y-2">
            {data.topSounds.map((s, i) => (
              <div key={s.soundId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#3a3c4e] w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <a href={`/sounds/${s.slug}`} className="text-sm font-medium text-[#c4c6d8] hover:text-accent-bright truncate block transition-colors">{s.title}</a>
                  <p className="text-xs text-[#5a5d72]">{s.downloads} downloads</p>
                </div>
                <span className="text-sm font-semibold text-teal">Rp {s.earnings.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
