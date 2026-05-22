// src/sounds/sounds.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  Optional,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import { SoundsService, SoundFilterDto, UploadSoundDto, UpdateSoundDto } from './sounds.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('sounds')
export class SoundsController {
  constructor(
    private soundsService: SoundsService,
    private prisma: PrismaService,
  ) {}

  // ─── GET /sounds ──────────────────────────────────────────
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async findAll(
    @Query() filters: SoundFilterDto,
    @Req() req: any,
  ) {
    // userId opsional untuk menampilkan isLiked
    const userId = req?.user?.sub ?? req?.user?.userId ?? undefined;
    return this.soundsService.findAll(filters, userId);
  }

  // ─── GET /sounds/categories  (public, for homepage/browse) ─
  @Get('categories')
  async getCategories() {
    return this.soundsService.getCategories();
  }

  // ─── GET /sounds/wishlist  (HARUS sebelum :slug) ──────────
  @Get('wishlist')
  @UseGuards(JwtAuthGuard)
  async getWishlist(
    @CurrentUser() userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.soundsService.getUserWishlist(userId, page, limit);
  }

  // ─── GET /sounds/downloads/history  (user's download history) ──
  @Get('downloads/history')
  @UseGuards(JwtAuthGuard)
  async getDownloadHistory(
    @CurrentUser() userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('licenseType') licenseType?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    return this.soundsService.getDownloadHistory(userId, page, limit, licenseType, categorySlug, search, source);
  }

  // ─── GET /sounds/mine  (author's own uploads) ────────────
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMySounds(
    @CurrentUser() userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.soundsService.getAuthorSounds(userId, page, limit);
  }

  // ─── POST /admin/sounds/upload ────────────────────────────
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'audio/wav', 'audio/x-wav', 'audio/wave',
          'audio/mpeg', 'audio/mp3',
          'audio/ogg', 'audio/vorbis',
          'audio/flac', 'audio/x-flac',
          'application/octet-stream', // browser kadang kirim ini
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|ogg|flac)$/i)) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported MIME type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadSound(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadSoundDto,
    @CurrentUser() uploaderId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File audio wajib diupload');
    }
    return this.soundsService.uploadSound(file, dto, uploaderId);
  }

  // ─── GET /sounds/:slug/related  (public) ────────────────
  @Get(':slug/related')
  async getRelated(
    @Param('slug') slug: string,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.soundsService.findRelated(slug, limit);
  }

  // ─── GET /sounds/creator/analytics  (butuh JWT) ──────────
  @Get('creator/analytics')
  @UseGuards(JwtAuthGuard)
  async getCreatorAnalytics(@CurrentUser() userId: string) {
    return this.soundsService.getCreatorAnalytics(userId);
  }

  // ─── GET /sounds/:slug ────────────────────────────────────
  @Get(':slug')
  async findOne(@Param('slug') slug: string, @Req() req: any) {
    const userId = req?.user?.sub ?? req?.user?.userId ?? undefined;
    return this.soundsService.findOne(slug, userId);
  }

  // ─── GET /sounds/:id/preview  (stream audio 30 detik) ────
  @Get(':id/preview')
  async streamPreview(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const info = await this.soundsService.getPreviewInfo(id);

    if (!info) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'Sound not found' });
    }

    // Jika previewUrl adalah URL eksternal (CDN/S3 public) → redirect
    if (info.previewUrl && info.previewUrl.startsWith('http')) {
      return res.redirect(302, info.previewUrl);
    }

    // Local file
    const filePath = this.soundsService.getLocalPreviewPath(info.previewUrl ?? '');
    if (!filePath) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'Preview file not available' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = (filePath.split('.').pop() ?? 'mp3').toLowerCase();
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };
    const contentType = mimeMap[ext] ?? 'audio/mpeg';

    // Dukung Range Request agar audio bisa di-seek
    const range: string | undefined = req.headers?.range;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunk = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }

  // ─── GET /sounds/:id/download-stream  (butuh JWT) ────────
  // Returns ZIP: audio file + license.txt
  @Get(':id/download-stream')
  @UseGuards(JwtAuthGuard)
  async streamDownload(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Res() res: Response,
  ) {
    const sound = await this.soundsService.findById(id);
    if (!sound) throw new NotFoundException('Sound not found');

    // Verifikasi akses — user harus punya download record (dari requestDownload)
    const lastDownload = await this.prisma.download.findFirst({
      where: { userId, soundEffectId: id },
      orderBy: { downloadedAt: 'desc' },
    });
    if (!lastDownload) {
      throw new ForbiddenException('Akses ditolak. Gunakan tombol Download untuk mengunduh.');
    }

    // Cek apakah download link sudah expired
    if (lastDownload.expiresAt && lastDownload.expiresAt < new Date()) {
      throw new ForbiddenException('Download link has expired. Click the Download button again to get a new link.');
    }

    // Subscription downloads diblokir kalau sound sudah unpublished; purchase tetap boleh
    if (!sound.isPublished && lastDownload.source === 'subscription') {
      throw new ForbiddenException('This sound is no longer available for download.');
    }

    // Untuk subscription downloads, re-verify bahwa subscription masih aktif
    if (lastDownload.source === 'subscription') {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
      if (!subscription || subscription.status !== 'ACTIVE' || subscription.currentPeriodEnd < new Date()) {
        throw new ForbiddenException('Your subscription is no longer active. Renew your plan to download again.');
      }
    }

    const filePath = this.soundsService.getLocalDownloadPath(sound.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Audio file not available');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    let licenseType = 'free';
    let invoiceNumber = `DL-${Date.now()}`;

    if (lastDownload?.source === 'purchase') {
      const orderItem = await this.prisma.orderItem.findFirst({
        where: { soundEffectId: id, order: { userId, status: 'PAID' } },
        include: { order: { include: { invoice: true } } },
        orderBy: { order: { paidAt: 'desc' } },
      });
      licenseType = orderItem?.licenseType ?? 'personal';
      invoiceNumber = orderItem?.order?.invoice?.invoiceNumber ?? invoiceNumber;
    } else if (lastDownload?.source === 'subscription') {
      licenseType = sound.accessLevel === 'FREE' ? 'free' : 'subscription';
    }

    // Stream file langsung — license tersedia di Download History page
    const ext = sound.format || 'wav';
    const fileName = `${sound.slug}.${ext}`;
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    };
    const contentType = mimeMap[ext] ?? 'audio/octet-stream';
    const stat = fs.statSync(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('X-License-Type', licenseType);
    res.setHeader('X-Invoice-Number', invoiceNumber);

    fs.createReadStream(filePath).pipe(res);
  }

  // ─── POST /sounds/:id/recalculate-duration  (admin/author only) ──
  @Post(':id/recalculate-duration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  async recalculateDuration(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.soundsService.recalculateDuration(id, userId);
  }

  // ─── POST /sounds/:id/play  (increment play count, no auth) ─
  @Post(':id/play')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async incrementPlay(@Param('id') id: string) {
    await this.soundsService.incrementPlayCount(id);
    return { ok: true };
  }

  // ─── POST /sounds/:id/download  (butuh JWT) ──────────────
  @Post(':id/download')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async requestDownload(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.soundsService.requestDownload(id, userId);
  }

  // ─── POST /sounds/:id/wishlist  (toggle) ─────────────────
  @Post(':id/wishlist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async toggleWishlist(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.soundsService.toggleWishlist(id, userId);
  }

  // ─── DELETE /sounds/:id/wishlist ──────────────────────────
  @Delete(':id/wishlist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeWishlist(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    // Panggil toggle — jika sudah di wishlist, akan dihapus
    const result = await this.soundsService.toggleWishlist(id, userId);
    // Jika baru saja ditambah (harusnya tidak terjadi via DELETE), hapus lagi
    if (result.liked) {
      return this.soundsService.toggleWishlist(id, userId);
    }
    return result;
  }

  // ─── PATCH /sounds/:id ────────────────────────────────────
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateSound(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Req() req: any,
    @Body() body: UpdateSoundDto,
  ) {
    const isAdmin = req.user?.role === 'ADMIN';
    return this.soundsService.updateSound(userId, id, body, isAdmin);
  }
}
