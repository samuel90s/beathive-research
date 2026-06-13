// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Providers from './providers';
import Navbar from '@/components/layout/Navbar';
import GlobalPlayer from '@/components/player/GlobalPlayer';
import { AppSidebarWrapper } from '@/components/layout/AppSidebarWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Arsonus — Premium Sound Effects & Music',
  description: 'Thousands of premium sound effects for content creators, game developers, and video creators.',
};

const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
const midtransSnapUrl = isProduction
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

// ── Theme detection script (aman — tidak pakai dangerouslySetInnerHTML) ──────
// Dijalankan sebelum React hydrate untuk mencegah flash of unstyled content (FOUC)
// Script ini hanya membaca sessionStorage dan menambahkan class ke <html>,
// tidak menerima input user sama sekali sehingga tidak bisa di-XSS.
const THEME_SCRIPT = `(function(){try{var t=JSON.parse(sessionStorage.getItem('beathive-auth')||sessionStorage.getItem('beathive-theme')||'{}');var theme=(t.state&&t.state.theme)||t.theme||'dark';document.documentElement.classList.add(theme);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/*
          Theme detection: pakai Script dengan strategy="beforeInteractive" agar
          tidak perlu dangerouslySetInnerHTML. Script ini hanya membaca
          sessionStorage — tidak ada user input yang diproses.
        */}
        <Script
          id="theme-detector"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className={`${inter.className} bg-base text-[#e2e3ef] antialiased`}>
        <Providers>
          <Navbar />
          <AppSidebarWrapper>
            {children}
          </AppSidebarWrapper>
          <GlobalPlayer />
        </Providers>
        <Script
          src={midtransSnapUrl}
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

