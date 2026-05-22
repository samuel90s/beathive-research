// src/app/auth/verify-email/page.tsx
'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { apiClient } from '@/lib/api/client';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  const handleResend = async () => {
    setResendStatus('loading');
    try {
      await apiClient.post('/auth/resend-verification');
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  if (verified === '1') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-teal-500/15 flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Email Terverifikasi!</h1>
          <p className="text-sm text-[#6b6f82] mb-6">Akun kamu sudah aktif. Silakan login.</p>
          <Link href="/auth/login" className="btn-accent px-6 py-2.5 rounded-xl text-sm font-semibold">
            Masuk Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Cek Email Kamu</h1>
        <p className="text-sm text-[#6b6f82] mb-6">
          Kami sudah kirim link verifikasi ke email kamu. Klik link tersebut untuk mengaktifkan akun.
        </p>
        <p className="text-xs text-[#3a3c4e]">
          Tidak dapat email?{' '}
          <button
            onClick={handleResend}
            disabled={resendStatus === 'loading' || resendStatus === 'sent'}
            className="text-accent-bright hover:underline disabled:opacity-50"
          >
            Kirim ulang
          </button>
        </p>
        {resendStatus === 'sent' && (
          <p className="text-xs text-teal-400 mt-2">Email verifikasi telah dikirim ulang.</p>
        )}
        {resendStatus === 'error' && (
          <p className="text-xs text-red-400 mt-2">Gagal mengirim email. Coba lagi.</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
