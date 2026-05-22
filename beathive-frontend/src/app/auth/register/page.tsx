// src/app/auth/register/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/store/auth.store';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register } = useAuth();
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
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError(null);
    try {
      await register(form.name, form.email, form.password);
      router.push('/browse');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-white">beat</span><span className="text-accent-bright">hive</span>
          </Link>
          <p className="text-[#6b6f6f82] text-sm mt-2">Create a free account</p>
        </div>

        <div className="card rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { key: 'name',     label: 'Full Name', type: 'text',     placeholder: 'John Doe' },
              { key: 'email',    label: 'Email',     type: 'email',    placeholder: 'you@example.com' },
              { key: 'password', label: 'Password',  type: 'password', placeholder: 'At least 8 characters' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-[#6b6f82] mb-1">{label}</label>
                <input type={type} value={form[key as keyof typeof form]} onChange={set(key)} required
                  placeholder={placeholder} className="w-full px-3 py-2.5 input-dark rounded-xl text-sm" />
              </div>
            ))}
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 btn-accent rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
          </form>
          <p className="text-xs text-center text-[#4a4d5e] mt-3">
            By signing up, you agree to our Terms &amp; Conditions
          </p>
        </div>

        <p className="text-center text-sm text-[#6b6f82] mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent-bright hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
