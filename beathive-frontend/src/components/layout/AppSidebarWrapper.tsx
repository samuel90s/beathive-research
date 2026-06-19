// src/components/layout/AppSidebarWrapper.tsx
'use client';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './AppSidebar';

const NO_SIDEBAR_PREFIXES = [
  '/auth', '/pricing', '/faq', '/checkout',
  '/not-found', '/admin', '/login', '/orders', '/subscriptions',
];

function shouldShowSidebar(pathname: string): boolean {
  if (pathname === '/') return false;
  return !NO_SIDEBAR_PREFIXES.some(p => pathname.startsWith(p));
}

export function AppSidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasSidebar = shouldShowSidebar(pathname);

  if (!hasSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 4rem)' }}>
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto scrollbar-none">
        {children}
      </main>
    </div>
  );
}
