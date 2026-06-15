// src/app/auth/login/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/store/auth.store';
import { authApi } from '@/lib/api/auth';
import BrandLogo from '@/components/layout/BrandLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && isAuthenticated) {
      router.replace('/browse');
    }
  }, [isAuthenticated, _hasHydrated, router]);

  if (!_hasHydrated || isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email, password, needs2FA ? totpToken : undefined);
      if ('requiresTwoFactor' in result) { setNeeds2FA(true); setLoading(false); return; }
      router.push('/browse');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        (err.request
          ? 'Unable to reach the server. Check that the backend is running and allows this site.'
          : 'Sign in failed. Please try again.'),
      );
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex">
            <BrandLogo frameClassName="h-10 w-10" textClassName="text-xl" />
          </Link>
          <p className="text-[#6b6f82] text-sm mt-2">Sign in to your account</p>
        </div>

        <div className="card rounded-2xl p-6">
          <a href={authApi.googleUrl()}
            className="flex items-center justify-center gap-2.5 w-full py-2.5 btn-ghost rounded-xl text-sm mb-4">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-rim" />
            <span className="text-xs text-[#4a4d5e]">or</span>
            <div className="flex-1 h-px bg-rim" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6b6f82] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2.5 input-dark rounded-xl text-sm" placeholder="you@example.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#6b6f82]">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-accent-bright hover:underline">Forgot password?</Link>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2.5 input-dark rounded-xl text-sm" placeholder="••••••••" />
            </div>
            {needs2FA && (
              <div>
                <label className="block text-xs font-medium text-[#6b6f82] mb-1">Authenticator Code</label>
                <input type="text" value={totpToken} onChange={e => setTotpToken(e.target.value)}
                  required={needs2FA} maxLength={6} placeholder="6-digit code" autoFocus
                  className="w-full px-3 py-2.5 input-dark rounded-xl text-sm font-mono tracking-widest" />
                <p className="text-xs text-[#5a5d72] mt-1">Enter the code from your authenticator app.</p>
              </div>
            )}
            {error && <p role="alert" aria-live="assertive" className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Signing in...' : needs2FA ? 'Verify & Sign In' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6b6f82] mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-accent-bright hover:underline font-medium">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
