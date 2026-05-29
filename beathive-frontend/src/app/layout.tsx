// src/app/layout.tsx
import type { Metadata } from 'next';
import { Oswald } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Providers from './providers';
import Navbar from '@/components/layout/Navbar';
import GlobalPlayer from '@/components/player/GlobalPlayer';
import { AppSidebarWrapper } from '@/components/layout/AppSidebarWrapper';

const oswald = Oswald({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Arsonus — Premium Sound Effects & Music',
  description: 'Thousands of premium sound effects for content creators, game developers, and video creators.',
};

const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
const midtransSnapUrl = isProduction
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* Tall Films Expanded — loaded via @font-face in globals.css */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=JSON.parse(localStorage.getItem('beathive-theme')||'{}').state?.theme||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();` }} />
      </head>
      <body className={`${oswald.className} bg-base text-[#e2e3ef] antialiased`}>
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
