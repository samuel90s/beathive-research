// src/components/layout/AppSidebar.tsx
'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSidebarStore } from '@/lib/store/sidebar.store';
import clsx from 'clsx';

// ─── Nav helpers ──────────────────────────────────────────────────────────────

function NavItem({ href, label, icon, exact, collapsed }: {
  href: string; label: string; icon: React.ReactNode; exact?: boolean; collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href}
      title={collapsed ? label : undefined}
      className={clsx(
        'flex items-center rounded-lg transition-all duration-100 group',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-3 py-2',
        isActive
          ? 'bg-accent/[0.12] text-white'
          : 'text-[#6b6f82] hover:text-[#c4c6d8] hover:bg-white/[0.05]',
      )}>
      <span className={clsx('flex-shrink-0', isActive ? 'text-accent-bright' : 'text-[#4a4d5e] group-hover:text-[#6b6f82]')}>
        {icon}
      </span>
      {!collapsed && <span className="text-[13px] font-medium truncate">{label}</span>}
    </Link>
  );
}

function BrowseTypeItem({ type, label, icon, collapsed }: {
  type: string; label: string; icon: React.ReactNode; collapsed: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get('soundType') ?? '';
  const currentCat = searchParams.get('categorySlug') ?? '';
  const SFX_SLUGS = ['foley','ambience','soundscape','nature','explosions','weapons','vehicles','ui-game','horror','human','animals','electronic','comedy','magic','sports','industrial'];
  const MUSIC_SLUGS = ['sound-scoring','cinematic','electronic-music','acoustic'];

  const isBrowse = pathname === '/browse';
  const isActive = isBrowse && (
    type === '' ? (!currentType && !currentCat) :
    type === 'sfx' ? (currentType === 'sfx' || SFX_SLUGS.includes(currentCat)) :
    type === 'music' ? (currentType === 'music' || MUSIC_SLUGS.includes(currentCat)) : false
  );
  const href = type === '' ? '/browse' : `/browse?soundType=${type}`;

  return (
    <Link href={href}
      title={collapsed ? label : undefined}
      className={clsx(
        'flex items-center rounded-lg transition-all duration-100 group',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-3 py-2',
        isActive
          ? 'bg-accent/[0.12] text-white'
          : 'text-[#6b6f82] hover:text-[#c4c6d8] hover:bg-white/[0.05]',
      )}>
      <span className={clsx('flex-shrink-0', isActive ? 'text-accent-bright' : 'text-[#4a4d5e] group-hover:text-[#6b6f82]')}>
        {icon}
      </span>
      {!collapsed && <span className="text-[13px] font-medium">{label}</span>}
    </Link>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-[#1a1b2e] my-2 mx-2" />;
  return (
    <p className="text-[10px] font-bold text-[#3a3c4e] uppercase tracking-[0.12em] px-3 mb-1.5 mt-0.5">
      {children}
    </p>
  );
}

// ─── Sidebar inner ────────────────────────────────────────────────────────────

function AppSidebarInner() {
  const { isAuthenticated } = useAuth();
  const { collapsed, toggle } = useSidebarStore();

  return (
    <aside className={clsx(
      'flex-shrink-0 hidden md:flex flex-col border-r border-[#1a1b2e] transition-all duration-200',
      collapsed ? 'w-14' : 'w-52',
    )}>
      {/* Toggle button */}
      <div className={clsx('flex py-3 px-2', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3a3c4e] hover:text-[#6b6f82] hover:bg-white/[0.05] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none py-2 px-2 space-y-4">

        {/* ── Browse ── */}
        <div>
          <SectionLabel collapsed={collapsed}>Browse</SectionLabel>
          <div className="space-y-0.5">
            <BrowseTypeItem type="" label="All Sounds" collapsed={collapsed}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} />
            <BrowseTypeItem type="sfx" label="Sound Effects" collapsed={collapsed}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>} />
            <BrowseTypeItem type="music" label="Music" collapsed={collapsed}
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} />
          </div>
        </div>

        {/* ── Account ── */}
        {isAuthenticated && (
          <>
            <div>
              <SectionLabel collapsed={collapsed}>Account</SectionLabel>
              <div className="space-y-0.5">
                <NavItem href="/dashboard/downloads" label="Download History" collapsed={collapsed}
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} />
                <NavItem href="/dashboard/orders" label="Orders" collapsed={collapsed}
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>} />
              </div>
            </div>

            <div>
              <SectionLabel collapsed={collapsed}>Creator</SectionLabel>
              <div className="space-y-0.5">
                <NavItem href="/studio" label="Studio" collapsed={collapsed} exact
                  icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>} />
              </div>
            </div>
          </>
        )}

        {/* Not logged in */}
        {!isAuthenticated && !collapsed && (
          <div className="border-t border-[#1a1b2e] pt-4 px-1 space-y-2">
            <p className="text-xs text-[#3a3c4e] px-2">Log in to download and save favorites</p>
            <Link href="/auth/login"
              className="block w-full text-center py-2 text-sm border border-[#2a2c3e] rounded-lg text-[#6b6f82] hover:text-white hover:border-white/10 transition-all">
              Log In
            </Link>
            <Link href="/auth/register"
              className="block w-full text-center py-2 text-sm font-semibold bg-accent hover:bg-accent-dim rounded-lg text-white transition-colors">
              Sign Up Free
            </Link>
          </div>
        )}

        {!isAuthenticated && collapsed && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <Link href="/auth/login" title="Log In"
              className="w-9 h-9 rounded-lg border border-[#2a2c3e] flex items-center justify-center text-[#6b6f82] hover:text-white transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </Link>
          </div>
        )}

      </div>
    </aside>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={<aside className="w-52 flex-shrink-0 border-r border-[#1a1b2e]" />}>
      <AppSidebarInner />
    </Suspense>
  );
}
