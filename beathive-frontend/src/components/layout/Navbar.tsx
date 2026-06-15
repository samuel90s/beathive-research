// src/components/layout/Navbar.tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCartStore } from '@/lib/store/cart.store';
import { subscriptionsApi } from '@/lib/api/subscriptions';
import { apiClient } from '@/lib/api/client';
import clsx from 'clsx';
import { mediaUrl } from '@/lib/utils';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import BrandLogo from '@/components/layout/BrandLogo';

function EqIcon() {
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-accent rounded-full origin-bottom animate-eq"
          style={{ height: `${[40, 90, 65, 80][i - 1]}%`, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function SearchBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (pathname === '/browse') {
      setQuery(searchParams.get('search') ?? '');
    }
  }, [pathname, searchParams]);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const destination = q ? `/browse?search=${encodeURIComponent(q)}` : '/browse';
    window.location.assign(destination);
  }, [query]);

  return (
    <form onSubmit={submit} className="hidden md:flex items-center relative mx-3 flex-1 max-w-xs">
      <svg className="absolute left-2.5 w-3.5 h-3.5 text-[#4a4d5e] pointer-events-none"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search sounds…"
        className="w-full pl-8 pr-3 h-8 text-sm bg-white/[0.04] border border-[#1e2030] rounded-lg text-[#c4c6d8] placeholder-[#3a3c4e] focus:outline-none focus:border-accent/40 focus:bg-white/[0.06] transition-all"
      />
    </form>
  );
}

function SearchBar() {
  return (
    <Suspense fallback={<div className="hidden md:block mx-3 flex-1 max-w-xs h-8" />}>
      <SearchBarInner />
    </Suspense>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const cartCount = useCartStore((s) => s.items.length);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdminArea = pathname.startsWith('/admin');

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionsApi.getMy,
    enabled: isAuthenticated && !isAdminArea,
    staleTime: 5 * 60 * 1000,
  });

  const isPaidPlan = subscription?.plan?.slug && subscription.plan.slug !== 'free';

  const navLinks = [
    { href: '/browse', label: 'Browse' },
    ...(!isPaidPlan ? [{ href: '/pricing', label: 'Pricing' }] : []),
    { href: '/faq', label: 'FAQ' },
  ];

  // Banner verifikasi email jika belum verified
  const showVerifyBanner = !isAdminArea && isAuthenticated && user && !(user as any).emailVerified;

  return (
    <>
      {showVerifyBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-400">
            Verifikasi email kamu untuk mengakses semua fitur.
          </p>
          <button
            onClick={async () => {
              try {
                await apiClient.post('/auth/resend-verification');
                alert('Email verifikasi dikirim!');
              } catch { /* ignore */ }
            }}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 underline flex-shrink-0"
          >
            Kirim ulang
          </button>
        </div>
      )}
      <nav className="sticky top-0 z-40 bg-[#0c0d16] border-b border-[#1a1b2e]">
        <div className="px-5 h-16 flex items-center gap-1">

          {/* Logo */}
          <Link href={isAdminArea ? '/admin' : '/'} className="flex items-center gap-2.5 mr-4 flex-shrink-0">
            <BrandLogo textClassName="text-[15px]" />
          </Link>

          {/* Desktop nav links — langsung setelah logo */}
          {isAdminArea ? (
            <div className="hidden sm:flex items-center gap-2 border-l border-rim pl-4">
              <span className="text-sm font-semibold text-white">Admin Panel</span>
              <span className="text-[10px] uppercase tracking-wider text-[#5a5d72] bg-white/[0.04] px-2 py-0.5 rounded-full">
                Workspace
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={clsx('px-3 py-1.5 text-sm rounded-lg transition-all duration-150',
                    pathname.startsWith(link.href)
                      ? 'text-white font-medium'
                      : 'text-[#5a5d72] hover:text-white hover:bg-white/[0.04]')}>
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && user?.role === 'ADMIN' && (
                <Link href="/admin"
                  className="px-3 py-1.5 text-sm rounded-lg text-[#5a5d72] hover:text-white hover:bg-white/[0.04] transition-all duration-150">
                  Admin
                </Link>
              )}
            </div>
          )}

          {!isAdminArea && <SearchBar />}

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1">

            {isAdminArea && (
              <Link href="/browse"
                aria-label="View public site"
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#8b8fa8] hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span className="hidden sm:inline">View site</span>
              </Link>
            )}

            {isAuthenticated && !isAdminArea && (
              <Link
                href="/wishlist"
                title="Wishlist"
                className={clsx(
                  'p-2 rounded-lg transition-all duration-150 hidden sm:flex',
                  pathname.startsWith('/wishlist')
                    ? 'text-rose-400 bg-rose-500/10'
                    : 'text-[#6b6f82] hover:text-rose-400 hover:bg-rose-500/10',
                )}
              >
                <svg width="17" height="17" viewBox="0 0 24 24"
                  fill={pathname.startsWith('/wishlist') ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </Link>
            )}

            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {!isAdminArea && (
              <Link
                href="/checkout"
                className="relative p-2 text-[#6b6f82] hover:text-white hover:bg-white/[0.05] rounded-lg transition-all duration-150"
              >
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 1h2l2.4 9.6a1 1 0 001 .8h7.2a1 1 0 001-.76L16 5H4"/>
                  <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="13.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-glow-sm">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Desktop user */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-1.5 ml-1" ref={menuRef}>
                {/* Subscription quota chip */}
                {!isAdminArea && subscription && !subscription.plan.unlimited && subscription.usage && (
                  <span className="text-[11px] text-[#5a5d72] bg-white/[0.04] border border-[#1a1b2e] px-2.5 py-1 rounded-full hidden lg:block">
                    {subscription.usage.downloadsThisMonth}/{subscription.plan.downloadLimit}/hari
                  </span>
                )}

                {/* Avatar dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(v => !v)}
                    className={clsx('flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full transition-all duration-150 border',
                      menuOpen || pathname.startsWith('/profile') || pathname.startsWith('/studio') || pathname.startsWith('/dashboard')
                        ? 'border-accent/30 bg-accent/10'
                        : 'border-[#1a1b2e] hover:border-white/10 hover:bg-white/[0.04]')}>
                    <div className="w-6 h-6 rounded-full bg-accent/25 flex items-center justify-center text-accent-bright text-[11px] font-bold overflow-hidden flex-shrink-0">
                      {user?.avatarUrl
                        ? <Image src={mediaUrl(user.avatarUrl)!} alt="" width={24} height={24} className="w-full h-full object-cover" />
                        : user?.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-[13px] text-[#c4c6d8] font-medium">{user?.name?.split(' ')[0]}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className={clsx('text-[#5a5d72] transition-transform', menuOpen && 'rotate-180')}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface border border-rim rounded-xl shadow-elevated z-50 py-1.5 overflow-hidden">
                      {/* User info header */}
                      <div className="px-4 py-2.5 border-b border-rim mb-1">
                        <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                        <p className="text-xs text-[#5a5d72] truncate">{user?.email}</p>
                        {subscription && (
                          <span className={clsx(
                            'inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold',
                            subscription.plan.slug === 'pro' ? 'bg-accent/20 text-accent-bright' : 'bg-white/[0.05] text-[#6b6f82]'
                          )}>
                            {subscription.plan.name}
                          </span>
                        )}
                      </div>

                      <Link href="/profile" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#c4c6d8] hover:text-white hover:bg-white/[0.05] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                        </svg>
                        Profil
                      </Link>

                      <div className="border-t border-rim my-1" />
                      <button onClick={() => { setMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 ml-2">
                <Link href="/auth/login"
                  className="px-4 py-1.5 text-[13px] text-[#8b8fa8] hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]">
                  Log In
                </Link>
                <Link href="/auth/register"
                  className="px-4 py-1.5 text-[13px] font-semibold bg-white text-black rounded-full hover:bg-white/90 transition-colors">
                  Sign Up Free
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            {!isAdminArea && (
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 rounded-lg text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors"
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile slide-in drawer */}
      {mobileOpen && !isAdminArea && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-surface border-r border-rim flex flex-col overflow-y-auto">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-rim">
              <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <BrandLogo frameClassName="h-7 w-7" textClassName="text-sm" />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-[#6b6f82] hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* User info (if logged in) */}
            {isAuthenticated && user && (
              <div className="px-4 py-3 border-b border-rim bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-bright text-sm font-bold overflow-hidden flex-shrink-0">
                    {user.avatarUrl
                      ? <Image src={mediaUrl(user.avatarUrl)!} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      : user.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-[#6b6f82] truncate">{user.email}</p>
                  </div>
                </div>
                {subscription && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={clsx(
                      'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                      subscription.plan.slug === 'pro' ? 'bg-accent/20 text-accent-bright' :
                      'bg-white/[0.05] text-[#6b6f82]'
                    )}>
                      {subscription.plan.name}
                    </span>
                    {subscription.usage && !subscription.plan.unlimited && (
                      <span className="text-[10px] text-[#6b6f82]">
                        {subscription.usage.downloadsThisMonth}/{subscription.plan.downloadLimit} /hari
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              <p className="text-[10px] font-semibold text-[#4a4d5e] uppercase tracking-widest px-2 mb-2">Menu</p>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-accent/15 text-accent-bright font-medium'
                      : 'text-[#8b8fa8] hover:text-white hover:bg-white/[0.05]',
                  )}
                >
                  {link.href === '/browse' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  )}
                  {link.href === '/pricing' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  )}
                  {link.href === '/faq' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  )}
                  {link.label}
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  <div className="border-t border-rim my-2" />
                  <p className="text-[10px] font-semibold text-[#4a4d5e] uppercase tracking-widest px-2 mb-2">Account</p>

                  <Link href="/profile" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Profile
                  </Link>
                  <Link href="/studio" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Studio
                  </Link>
                  <Link href="/dashboard/downloads" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download History
                  </Link>
                  <Link href="/dashboard/orders" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    Orders
                  </Link>
                  <Link href="/wishlist" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8b8fa8] hover:text-white hover:bg-white/[0.05] transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    Wishlist
                  </Link>

                  {user?.role === 'ADMIN' && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Admin
                    </Link>
                  )}
                </>
              )}

              {!isAuthenticated && (
                <div className="pt-2 space-y-2">
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-2.5 rounded-xl text-sm border border-rim text-[#c4c6d8] hover:bg-white/[0.05] transition-colors">
                    Login
                  </Link>
                  <Link href="/auth/register" onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium btn-accent transition-colors">
                    Sign Up
                  </Link>
                </div>
              )}
            </nav>

            {/* Mobile bottom actions */}
            {isAuthenticated && (
              <div className="px-4 pb-6 border-t border-rim pt-3 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <ThemeToggle />
                  <span className="text-xs text-[#6b6f82]">Toggle theme</span>
                </div>
                <button
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
