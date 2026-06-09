// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // allow frontend (port 3001) to load images/audio from backend (port 3000)
  }));
  app.useStaticAssets(join(process.cwd(), 'uploads', 'avatars'), { prefix: '/uploads/avatars' });
  app.useStaticAssets(join(process.cwd(), 'uploads', 'previews'), { prefix: '/uploads/previews' });

  // Global validation pipe — validasi semua DTO otomatis
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // must stay false: multipart form-data sends extra fields that would fail strict validation
      transform: true,             // auto-transform ke tipe yang benar (Number, Boolean, dll)
    }),
  );

  // CORS — izinkan request dari frontend
  // BE-CONFIG-01 fix: gunakan STRICT_CORS=true di staging/demo agar tidak auto-allow semua origin
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:3001',
    ...(process.env.EXTRA_ALLOWED_ORIGINS ? process.env.EXTRA_ALLOWED_ORIGINS.split(',') : []),
  ];
  const strictCors = process.env.NODE_ENV === 'production' || process.env.STRICT_CORS === 'true';

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Izinkan request tanpa origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Strict mode (production + staging): tolak origin tidak dikenal
      if (strictCors) return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      // Development only: izinkan semua origin
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept-Ranges'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  // Global prefix untuk semua route
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Arsonus Backend berjalan di: http://localhost:${port}/api/v1`);
  console.log(`Storage mode: ${process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_access_key' ? 'AWS S3' : 'LOCAL (./uploads/)'}`);
}

bootstrap();
