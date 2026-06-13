// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hpp = require('hpp');
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

const isProd = process.env.NODE_ENV === 'production';
const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Sembunyikan stack trace dari response error di production
    logger: isProd ? ['error', 'warn', 'log'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // ── Trust proxy (penting untuk rate limiting & IP detection di behind nginx) ──
  app.set('trust proxy', 1);

  // ── HTTP Security Headers via Helmet ────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Midtrans Snap
          'https://app.midtrans.com',
          'https://app.sandbox.midtrans.com',
          "'unsafe-inline'", // hanya dev — hapus di production jika bisa
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'http://localhost:3000', process.env.CDN_URL || ''].filter(Boolean),
        connectSrc: [
          "'self'",
          'http://localhost:3000',
          'http://localhost:3001',
          process.env.FRONTEND_URL || '',
          process.env.API_URL || '',
        ].filter(Boolean),
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      } as any,
    },
    // Cegah clickjacking
    frameguard: { action: 'deny' },
    // Cegah MIME-type sniffing
    noSniff: true,
    // Hide X-Powered-By
    hidePoweredBy: true,
    // HSTS — hanya di production dengan HTTPS
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    // XSS filter (legacy browsers)
    xssFilter: true,
  }));

  // ── HPP — Cegah HTTP Parameter Pollution ────────────────────────────────────
  // Contoh serangan: ?sort=price&sort='; DROP TABLE-- → ambil array tapi pakai yang terakhir
  // HPP mengambil nilai terakhir dari parameter duplikat (whitelist boleh array)
  app.use(hpp({
    whitelist: ['tags', 'genres', 'moods'], // field ini memang boleh multi-value
  }));

  // ── Static assets ────────────────────────────────────────────────────────────
  app.useStaticAssets(join(process.cwd(), 'uploads', 'avatars'), { prefix: '/uploads/avatars' });
  app.useStaticAssets(join(process.cwd(), 'uploads', 'previews'), { prefix: '/uploads/previews' });

  // ── Global Validation Pipe ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // must stay false: multipart form-data sends extra fields
      transform: true,
      // Batasi payload JSON maksimum 10MB (audio upload via multipart tidak kena ini)
      stopAtFirstError: false,
    }),
  );

  // ── Global Exception Filter — sembunyikan stack trace di production ──────────
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:3001',
    ...(process.env.EXTRA_ALLOWED_ORIGINS ? process.env.EXTRA_ALLOWED_ORIGINS.split(',') : []),
  ];
  const strictCors = isProd || process.env.STRICT_CORS === 'true';

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (strictCors) return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept-Ranges'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  // ── Global Prefix ─────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // ── Structured startup log ─────────────────────────────────────────────────
  const storageMode = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_access_key' ? 'AWS S3' : 'LOCAL';
  const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  logger.log(`🚀 Arsonus Backend started`);
  logger.log(`   URL      : http://localhost:${port}/api/v1`);
  logger.log(`   Mode     : ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  logger.log(`   Storage  : ${storageMode}`);
  logger.log(`   PID      : ${process.pid}`);
  logger.log(`   Memory   : ${memMB} MB`);
  logger.log(`   Health   : http://localhost:${port}/api/v1/health`);
}

bootstrap();

