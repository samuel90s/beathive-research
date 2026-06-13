/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

// ── Security Headers ──────────────────────────────────────────────────────────
const securityHeaders = [
  // Cegah clickjacking — halaman tidak bisa di-iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Cegah MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Batasi info referrer yang dikirim ke domain lain
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Batasi fitur browser yang bisa diakses (cegah fingerprinting)
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',         // tidak perlu kamera
      'microphone=(self)', // hanya domain sendiri (untuk preview audio)
      'geolocation=()',    // tidak perlu lokasi
      'payment=(self https://app.midtrans.com https://app.sandbox.midtrans.com)',
    ].join(', '),
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Script: hanya domain sendiri + Midtrans + unsafe-inline untuk Next.js inline scripts
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com`,
      // Style: izinkan Google Fonts + inline styles (Next.js butuh ini)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Font
      "font-src 'self' https://fonts.gstatic.com",
      // Gambar: izinkan data URLs, blob, dan semua HTTPS (untuk CDN/avatar)
      "img-src 'self' data: blob: https:",
      // Audio/video: izinkan backend lokal dan CDN
      `media-src 'self' blob: http://localhost:3000 ${process.env.NEXT_PUBLIC_API_URL || ''}`,
      // API requests: izinkan backend
      `connect-src 'self' http://localhost:3000 http://localhost:3001 ${process.env.NEXT_PUBLIC_API_URL || ''} https://api.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com`,
      // Iframe: tolak semua
      "frame-src 'none'",
      // Plugin objects (Flash, dll): tolak
      "object-src 'none'",
      // Form action: hanya domain sendiri
      "base-uri 'self'",
      "form-action 'self'",
      // HTTPS upgrade di production
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join('; '),
  },
  // HSTS — hanya di production dengan HTTPS
  ...(isProd ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  }] : []),
];

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http',  hostname: 'localhost', port: '3000' },
      { protocol: 'https', hostname: '**' }, // CDN/S3 in production
    ],
  },
  async headers() {
    return [
      {
        // Terapkan ke semua route
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION,
  },
};

export default nextConfig;
