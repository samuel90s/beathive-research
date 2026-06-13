'use client';
import { API_URL as API } from '@/lib/config';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';

interface Sound {
  id: string;
  title: string;
  slug: string;
  description?: string;
  format: string;
  accessLevel: string;
  price: number;
  licenseType: string;
  reviewStatus: string;
  reviewNote?: string;
  durationMs: number;
  fileSize: number;
  previewUrl: string;
  playCount: number;
  downloadCount: number;
  isPublished: boolean;
  publishedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  waveformData?: number[];
  category: { name: string; icon?: string };
  author?: { id: string; name: string; email: string; createdAt: string; _count?: { uploadedAssets: number } } | null;
  tags?: { tag: { name: string; slug: string } }[];
  _count?: { downloads: number; ratings: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:         'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  APPROVED:        'bg-teal-500/10 text-teal-400 border border-teal-500/30',
  REJECTED:        'bg-red-500/10 text-red-400 border border-red-500/30',
  NEEDS_RE_REVIEW: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:         'Pending',
  APPROVED:        'Approved',
  REJECTED:        'Rejected',
  NEEDS_RE_REVIEW: 'Needs Re-review',
};

const ACCESS_COLORS: Record<string, string> = {
  FREE:     'bg-green-500/10 text-green-400',
  PRO:      'bg-accent/10 text-accent-bright',
  BUSINESS: 'bg-carmine/10 text-carmine',
  PURCHASE: 'bg-amber-500/10 text-amber-400',
};

function formatDur(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Mini Waveform ─────────────────────────────────────────────────────────
function WaveformBars({ data }: { data?: number[] }) {
  const bars = data?.length ? data : Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2);
  return (
    <div className="flex items-end gap-[2px] h-10 w-full overflow-hidden">
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-accent/40 rounded-[1px] min-w-[2px]"
          style={{ height: `${Math.max(10, v * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────
function AudioPlayer({ soundId, previewUrl, api }: { soundId: string; previewUrl: string; api: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(`${api}/sounds/${soundId}/preview`);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    audio.onended = () => setPlaying(false);
    return () => { audio.pause(); audio.src = ''; };
  }, [soundId, api]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <rect x="1" y="0" width="3" height="10" rx="1"/><rect x="6" y="0" width="3" height="10" rx="1"/>
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
            <polygon points="1,0 10,6 1,12"/>
          </svg>
        )}
      </button>
      <div className="flex-1">
        <div
          className="h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-accent rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-[#6b6f82]">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────
function DetailPanel({
  sound,
  onClose,
  onApprove,
  onReject,
  actionLoading,
}: {
  sound: Sound;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, title: string) => void;
  actionLoading: string | null;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-rim flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#6b6f82] mb-1">Detail Sound</p>
          <h2 className="text-base font-semibold text-white leading-tight truncate">{sound.title}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#6b6f82] hover:text-white transition-colors flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[sound.reviewStatus]}`}>
            {STATUS_LABELS[sound.reviewStatus] ?? sound.reviewStatus}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ACCESS_COLORS[sound.accessLevel]}`}>
            {sound.accessLevel}
          </span>
          {sound.isPublished && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              Published
            </span>
          )}
        </div>

        {/* Audio Player */}
        <div className="card-lift rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest">Preview Audio</p>
          <WaveformBars data={sound.waveformData} />
          <AudioPlayer soundId={sound.id} previewUrl={sound.previewUrl} api={API} />
        </div>

        {/* Sound Info */}
        <div>
          <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest mb-3">Sound Info</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Kategori</p>
              <p className="text-white font-medium text-xs">{sound.category?.icon} {sound.category?.name}</p>
            </div>
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Format</p>
              <p className="text-white font-medium text-xs">{sound.format?.toUpperCase()}</p>
            </div>
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Durasi</p>
              <p className="text-white font-medium text-xs">{formatDur(sound.durationMs)}</p>
            </div>
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Ukuran File</p>
              <p className="text-white font-medium text-xs">{formatBytes(sound.fileSize)}</p>
            </div>
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Price</p>
              <p className="text-white font-medium text-xs">
                {sound.price === 0 ? 'Free' : `Rp ${sound.price.toLocaleString('id-ID')}`}
              </p>
            </div>
            <div className="card-lift rounded-lg p-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-0.5">Lisensi</p>
              <p className="text-white font-medium text-xs capitalize">{sound.licenseType}</p>
            </div>
          </div>

          {/* Tags */}
          {(sound.tags?.length ?? 0) > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-[#6b6f82] uppercase mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {(sound.tags ?? []).map(t => (
                  <span key={t.tag.slug} className="text-xs px-2 py-0.5 bg-accent/10 text-accent-bright rounded-full border border-accent/20">
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {sound.description && (
          <div>
            <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest mb-2">Deskripsi</p>
            <p className="text-sm text-[#c4c6d8] leading-relaxed card-lift rounded-xl p-3">{sound.description}</p>
          </div>
        )}

        {/* Stats */}
        <div>
          <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest mb-3">Statistik</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Play', value: sound.playCount ?? 0 },
              { label: 'Download', value: sound._count?.downloads ?? sound.downloadCount ?? 0 },
              { label: 'Rating', value: sound._count?.ratings ?? 0 },
            ].map(stat => (
              <div key={stat.label} className="card-lift rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{stat.value}</p>
                <p className="text-[10px] text-[#6b6f82]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Author */}
        {sound.author && (
          <div>
            <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest mb-2">Creator</p>
            <div className="card-lift rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-bright text-sm font-bold flex-shrink-0">
                {sound.author.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{sound.author.name}</p>
                <p className="text-xs text-[#6b6f82] truncate">{sound.author.email}</p>
                <p className="text-[10px] text-[#5a5d72] mt-0.5">
                  {sound.author._count?.uploadedAssets ?? '?'} uploads · Bergabung {formatDate(sound.author.createdAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="text-xs font-semibold text-[#6b6f82] uppercase tracking-widest mb-2">Timeline</p>
          <div className="space-y-1.5 text-xs text-[#6b6f82]">
            <div className="flex justify-between">
              <span>Diupload</span>
              <span className="text-[#8b8fa8]">{formatDate(sound.createdAt)}</span>
            </div>
            {sound.publishedAt && (
              <div className="flex justify-between">
                <span>Dipublish</span>
                <span className="text-[#8b8fa8]">{formatDate(sound.publishedAt)}</span>
              </div>
            )}
            {sound.reviewedAt && (
              <div className="flex justify-between">
                <span>Direview</span>
                <span className="text-[#8b8fa8]">{formatDate(sound.reviewedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Review Note */}
        {sound.reviewNote && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
            <p className="text-[10px] text-red-400 uppercase font-semibold mb-1">Catatan Reject</p>
            <p className="text-sm text-red-300">{sound.reviewNote}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 border-t border-rim px-5 py-4">
        <div className="flex gap-2">
          {sound.reviewStatus !== 'APPROVED' && (
            <button
              onClick={() => onApprove(sound.id)}
              disabled={actionLoading === sound.id}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading === sound.id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Approve
                </>
              )}
            </button>
          )}
          {sound.reviewStatus !== 'REJECTED' && (
            <button
              onClick={() => onReject(sound.id, sound.title)}
              disabled={actionLoading === sound.id}
              className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reject
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
const STATUS_TABS = ['ALL', 'PENDING', 'NEEDS_RE_REVIEW', 'APPROVED', 'REJECTED'] as const;

export default function AdminSoundsPage() {
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<string>('PENDING');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Sound | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const token = () => accessToken || localStorage.getItem('accessToken');

  const fetchSounds = async () => {
    setLoading(true);
    try {
      const status = tab === 'ALL' ? '' : `status=${tab}&`;
      const res = await fetch(`${API}/admin/sounds?${status}limit=100`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Sound[] = data.items || [];
      setSounds(items);
      setTotal(data.pagination?.total || 0);
      if (selected) {
        const updated = items.find((s) => s.id === selected.id);
        setSelected(updated ?? null);
      }
    } catch (err) {
      console.error('Failed to fetch sounds:', err);
      setSounds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSounds(); }, [tab]);

  const approve = async (id: string) => {
    setActionLoading(id);
    await fetch(`${API}/admin/sounds/${id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}` },
    });
    setActionLoading(null);
    await fetchSounds();
  };

  const openReject = (id: string, title: string) => {
    setRejectModal({ id, title });
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    await fetch(`${API}/admin/sounds/${rejectModal.id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason || 'Does not meet quality standards' }),
    });
    setRejectModal(null);
    setRejectReason('');
    setActionLoading(null);
    await fetchSounds();
  };

  const panelOpen = !!selected;

  return (
    <div className="flex gap-5 h-[calc(100vh-4rem)] -mx-6 px-6 overflow-hidden">

      {/* ── Left: List ── */}
      <div className={`flex flex-col min-w-0 transition-all duration-300 ${panelOpen ? 'w-[380px] flex-shrink-0' : 'flex-1'}`}>

        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-white">Sound Review</h1>
            <p className="text-sm text-[#6b6f82] mt-0.5">{total} sounds found</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/[0.05] p-1 rounded-xl w-fit flex-shrink-0">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t ? 'bg-surface text-white shadow-sm' : 'text-[#6b6f82] hover:text-[#c4c6d8]'
              }`}
            >
              {t === 'ALL' ? 'All' : STATUS_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sounds.length === 0 ? (
            <div className="text-center py-20 card rounded-2xl border border-rim">
              <p className="text-[#6b6f82] text-sm">No sounds found with this status</p>
            </div>
          ) : (
            sounds.map(s => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(prev => prev?.id === s.id ? null : s)}
                onKeyDown={e => e.key === 'Enter' && setSelected(prev => prev?.id === s.id ? null : s)}
                className={`w-full text-left card rounded-xl border p-3.5 transition-all cursor-pointer ${
                  selected?.id === s.id
                    ? 'border-accent/50 bg-accent/5'
                    : 'border-rim hover:border-white/10 hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Mini play indicator */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    selected?.id === s.id ? 'bg-accent' : 'bg-white/[0.05]'
                  }`}>
                    <svg width="8" height="10" viewBox="0 0 8 10" fill={selected?.id === s.id ? 'white' : '#6b7280'}>
                      <polygon points="0,0 8,5 0,10"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{s.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[s.reviewStatus]}`}>
                        {STATUS_LABELS[s.reviewStatus] ?? s.reviewStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#6b6f82] mt-0.5 truncate">
                      {s.category?.name} · {s.format?.toUpperCase()} · {formatDur(s.durationMs)}
                      {s.author && ` · ${s.author.name}`}
                    </p>
                    <p className="text-[10px] text-[#5a5d72] mt-0.5">{formatDate(s.createdAt)}</p>
                  </div>
                  {/* Quick actions inline only if panel closed */}
                  {!panelOpen && (s.reviewStatus === 'PENDING' || s.reviewStatus === 'NEEDS_RE_REVIEW') && (
                    <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => approve(s.id)}
                        disabled={actionLoading === s.id}
                        className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === s.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => openReject(s.id, s.title)}
                        className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {/* Arrow indicator when panel open */}
                  {panelOpen && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={selected?.id === s.id ? 'text-accent-bright' : 'text-[#4a4d5e]'}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      {panelOpen && selected && (
        <div className="flex-1 min-w-0 card rounded-2xl border border-rim overflow-hidden animate-slide-in">
          <DetailPanel
            sound={selected}
            onClose={() => setSelected(null)}
            onApprove={approve}
            onReject={openReject}
            actionLoading={actionLoading}
          />
        </div>
      )}

      {/* ── Empty state (panel open but no selection) ── */}
      {!panelOpen && !loading && sounds.length > 0 && (
        <></>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="card-lift rounded-2xl w-full max-w-md p-6 border border-rim shadow-elevated animate-fade-up">
            <h3 className="text-base font-semibold text-white mb-1">Reject Sound</h3>
            <p className="text-sm text-[#6b6f82] mb-4 truncate">"{rejectModal.title}"</p>
            <label className="block text-xs font-medium text-[#8b8fa8] mb-1.5">
              Rejection reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder="e.g. Audio quality too low, there is noise at 0:45..."
              className="w-full input-dark rounded-xl text-sm resize-none p-3"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 btn-ghost rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
