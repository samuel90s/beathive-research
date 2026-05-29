// src/components/ui/LicenseCertModal.tsx
'use client';
import { useEffect } from 'react';
import type { DownloadHistoryItem } from '@/types';
import { formatPrice } from '@/lib/utils';

interface Props {
  item: DownloadHistoryItem;
  onClose: () => void;
}

const LICENSE_INFO = {
  personal: {
    label: 'Personal License',
    color: 'text-teal-400',
    border: 'border-teal-500/20',
    bg: 'bg-teal-500/10',
    allowed: [
      'Konten personal & non-komersial',
      'YouTube, podcast, & video pribadi',
      'Proyek edukasi & portfolio',
      'Tanpa batas durasi penggunaan',
    ],
    disallowed: [
      'Iklan komersial berbayar',
      'Siaran TV / radio',
      'Distribusi sebagai produk komersial',
    ],
  },
  commercial: {
    label: 'Commercial License',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
    allowed: [
      'Iklan & konten promosi bisnis',
      'YouTube monetized & brand content',
      'Aplikasi & produk digital',
      'Platform streaming komersial',
    ],
    disallowed: [
      'Siaran TV / radio nasional',
      'Redistribusi / dijual kembali',
    ],
  },
  sync: {
    label: 'Sync License',
    color: 'text-accent-bright',
    border: 'border-accent/20',
    bg: 'bg-accent/10',
    allowed: [
      'Film, series, & video production',
      'Iklan TV & digital advertising',
      'Game & aplikasi interaktif',
      'Platform streaming internasional',
      'Distribusi global tanpa batas',
    ],
    disallowed: [
      'Siaran TV frekuensi publik',
      'Redistribusi audio mentah',
    ],
  },
  broadcast: {
    label: 'Broadcast License',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
    allowed: [
      'Siaran TV & radio nasional',
      'Semua hak Sync License',
      'Distribusi fisik (DVD, Blu-ray)',
      'Hak global tanpa batasan',
      'Penggunaan komersial skala besar',
    ],
    disallowed: [
      'Redistribusi file audio mentah',
    ],
  },
} as const;

const CAT_GRADIENT: Record<string, string> = {
  'foley': 'from-rose-500 to-pink-600',
  'ambience': 'from-amber-400 to-orange-500',
  'soundscape': 'from-teal-500 to-cyan-600',
  'nature': 'from-green-500 to-emerald-600',
  'explosions': 'from-red-500 to-orange-600',
  'weapons': 'from-slate-600 to-zinc-700',
  'vehicles': 'from-blue-500 to-indigo-600',
  'ui-game': 'from-violet-500 to-purple-600',
  'horror': 'from-purple-900 to-indigo-950',
  'human': 'from-amber-400 to-yellow-500',
  'animals': 'from-lime-500 to-green-600',
  'electronic': 'from-cyan-500 to-blue-600',
  'comedy': 'from-yellow-400 to-amber-500',
  'magic': 'from-pink-500 to-violet-600',
  'sports': 'from-emerald-500 to-green-600',
  'industrial': 'from-stone-500 to-zinc-600',
  'sound-scoring': 'from-violet-600 to-indigo-700',
  'cinematic': 'from-indigo-600 to-blue-800',
  'electronic-music': 'from-cyan-500 to-teal-600',
  'acoustic': 'from-amber-500 to-orange-600',
};

function shortLicNum(id: string) {
  return 'BH-LIC-' + id.slice(-8).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function LicenseCertModal({ item, onClose }: Props) {
  const info = LICENSE_INFO[item.licenseType] ?? LICENSE_INFO.personal;
  const gradient = CAT_GRADIENT[item.categorySlug] ?? 'from-slate-600 to-slate-700';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#12131f] border border-[#1e2035] rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2035]">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffaa4d" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <h2 className="text-base font-700 text-white font-bold">Sertifikat Lisensi</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#1e2035] text-[#6b6f82] hover:text-white hover:border-white/10 flex items-center justify-center transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto scrollbar-none">

          {/* Sound hero */}
          <div className="flex items-center gap-4 p-4 bg-[#0c0d16] rounded-xl mb-5">
            <div className={`w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient}`} />
            <div className="min-w-0">
              <p className="text-base font-semibold text-white truncate">{item.soundTitle}</p>
              <p className="text-sm text-[#5a5d72] mt-0.5">
                {item.categoryName}{item.authorName ? ` · oleh ${item.authorName}` : ''}
              </p>
            </div>
            <span className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${info.bg} ${info.color} ${info.border}`}>
              {info.label}
            </span>
          </div>

          {/* License details */}
          <div className="space-y-0 mb-5 rounded-xl border border-[#1e2035] overflow-hidden">
            {[
              { label: 'Nomor Lisensi', value: shortLicNum(item.id), mono: true },
              { label: 'Tanggal Download', value: fmtDate(item.downloadedAt) },
              { label: 'Diperoleh via', value: item.source === 'subscription' ? 'Subscription' : `Pembelian · ${formatPrice(item.priceAtPurchase ?? 0)}` },
              { label: 'Format File', value: item.soundFormat.toUpperCase() },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-[#1a1b2e] last:border-b-0">
                <span className="text-sm text-[#5a5d72]">{label}</span>
                <span className={`text-sm text-[#c4c6d8] font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Rights */}
          <div className="bg-[#0c0d16] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-[#3a3c4e] uppercase tracking-widest mb-3">Hak yang Diberikan</p>
            <div className="space-y-2">
              {info.allowed.map((right) => (
                <div key={right} className="flex items-start gap-2.5 text-sm text-[#c4c6d8]">
                  <svg className="text-teal-400 flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {right}
                </div>
              ))}
              {info.disallowed.length > 0 && (
                <div className="border-t border-[#1a1b2e] pt-2 mt-2 space-y-2">
                  {info.disallowed.map((right) => (
                    <div key={right} className="flex items-start gap-2.5 text-sm text-[#5a5d72]">
                      <svg className="text-red-400/70 flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      {right}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e2035] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-[#1e2035] text-[#6b6f82] hover:text-[#c4c6d8] hover:border-white/10 transition-all"
          >
            Tutup
          </button>
          <button
            onClick={() => alert('PDF license download coming soon')}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#F7941D] hover:bg-[#e07e0a] text-white transition-colors"
          >
            ⬇ Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
