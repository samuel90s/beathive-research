// src/sounds/sounds.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { AudioService } from '../common/audio/audio.service';
import { EarningsService } from '../earnings/earnings.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// ─── DTOs ─────────────────────────────────────────────────

export class SoundFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  /** Filter berdasarkan tipe: "sfx" atau "music" */
  @IsOptional()
  @IsString()
  soundType?: string;

  /** Filter hanya sound gratis (price = 0) */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isFree?: boolean;

  /** Filter berdasarkan level akses: FREE | PRO | BUSINESS | PURCHASE */
  @IsOptional()
  @IsEnum(['FREE', 'PRO', 'BUSINESS', 'PURCHASE'])
  accessLevel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDuration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDuration?: number;

  @IsOptional()
  @IsString()
  tags?: string; // comma-separated tag slugs

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsEnum(['personal', 'commercial'])
  licenseType?: string;

  // Music-specific filters
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minBpm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxBpm?: number;

  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  musicalKey?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasStems?: boolean;

  @IsOptional()
  @IsString()
  genreSlug?: string;

  @IsOptional()
  @IsString()
  genres?: string; // comma-separated genre slugs

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UploadSoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price must be an integer number' })
  @Min(0)
  @Max(10_000_000)
  price?: number;

  @IsOptional()
  @IsEnum(['FREE', 'PRO', 'BUSINESS', 'PURCHASE'])
  accessLevel?: string;

  @IsOptional()
  @IsString()
  licenseType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^[a-zA-Z0-9,\s\-]*$/, { message: 'tags may only contain letters, numbers, commas, spaces, or hyphens' })
  tags?: string; // comma-separated tag names

  // Music metadata
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  bpm?: number;

  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  musicalKey?: string;

  @IsOptional()
  @IsString()
  genres?: string; // comma-separated genre names/slugs

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasStems?: boolean;
}

export class UpdateSoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price must be an integer number' })
  @Min(0)
  @Max(10_000_000)
  price?: number;

  @IsOptional()
  @IsEnum(['FREE', 'PRO', 'BUSINESS', 'PURCHASE'])
  accessLevel?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @Transform(({ value }) => value || undefined)
  tags?: string[] | string;

  // Music metadata
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  bpm?: number;

  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  musicalKey?: string;

  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  genres?: string[];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasStems?: boolean;
}

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audio: AudioService,
    private config: ConfigService,
    private earnings: EarningsService,
  ) {}

  private parseOptionalInt(value: unknown, fieldName: string, max = 10_000_000): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
      throw new BadRequestException(`${fieldName} must be a whole number between 0 and ${max}`);
    }

    return parsed;
  }

  // ─── List sounds ─────────────────────────────────────────

  async findAll(filters: SoundFilterDto, userId?: string) {
    const {
      search,
      categorySlug,
      authorId,
      isFree,
      accessLevel,
      page = 1,
      limit = 20,
      sortBy = 'newest',
    } = filters;

    const minPrice = filters.minPrice ?? filters.priceMin;
    const maxPrice = filters.maxPrice ?? filters.priceMax;

    if (filters.minDuration !== undefined && filters.maxDuration !== undefined && filters.minDuration > filters.maxDuration) {
      throw new BadRequestException('minDuration cannot exceed maxDuration');
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new BadRequestException('minPrice cannot exceed maxPrice');
    }

    const where: any = { isPublished: true };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    } else if (filters.soundType) {
      where.assetType = String(filters.soundType).toLowerCase() === 'music' ? 'MUSIC' : 'SFX';
    }
    if (authorId) where.authorId = authorId;

    if (isFree !== undefined) {
      where.price = String(isFree) === 'true' || isFree === true ? 0 : { gt: 0 };
    }

    if (accessLevel) where.accessLevel = accessLevel;
    if (filters.licenseType) {
      where.licenseType = { in: [filters.licenseType, 'both'] };
    }

    if (filters.minDuration !== undefined) {
      where.durationMs = { ...(where.durationMs ?? {}), gte: filters.minDuration };
    }
    if (filters.maxDuration !== undefined) {
      where.durationMs = { ...(where.durationMs ?? {}), lte: filters.maxDuration };
    }

    // Only apply price range when isFree is NOT set
    if (isFree === undefined) {
      if (minPrice !== undefined) {
        where.price = { ...(typeof where.price === 'object' && where.price !== null ? where.price : {}), gte: minPrice };
      }
      if (maxPrice !== undefined) {
        where.price = { ...(typeof where.price === 'object' && where.price !== null ? where.price : {}), lte: maxPrice };
      }
    }

    if (filters.tags) {
      const tagSlugs = filters.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagSlugs.length > 0) {
        where.tags = { some: { tag: { slug: { in: tagSlugs } } } };
      }
    }

    const musicMetadataWhere: any = {};
    if (filters.minBpm !== undefined) {
      musicMetadataWhere.bpm = { ...(musicMetadataWhere.bpm ?? {}), gte: filters.minBpm };
    }
    if (filters.maxBpm !== undefined) {
      musicMetadataWhere.bpm = { ...(musicMetadataWhere.bpm ?? {}), lte: filters.maxBpm };
    }
    if (filters.mood) {
      musicMetadataWhere.mood = filters.mood;
    }
    if (filters.musicalKey) {
      musicMetadataWhere.musicalKey = filters.musicalKey;
    }
    if (filters.hasStems !== undefined) {
      musicMetadataWhere.hasStems = filters.hasStems;
    }
    if (Object.keys(musicMetadataWhere).length > 0) {
      where.musicMetadata = { is: musicMetadataWhere };
    }
    const genreSlugs = [
      ...(filters.genreSlug ? [filters.genreSlug] : []),
      ...(filters.genres ? filters.genres.split(',') : []),
    ].map(g => this.toSlug(g.trim())).filter(Boolean);
    if (genreSlugs.length > 0) {
      where.genres = { some: { genre: { slug: { in: genreSlugs } } } };
    }

    // Saat ada search query, urutkan by relevance (exact match dulu, lalu downloadCount)
    // Untuk sort lainnya, gunakan field sort biasa
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isSearchMode = !!search && sortBy === 'newest';
    const orderBy: any = isSearchMode
      ? [{ downloadCount: 'desc' }, { playCount: 'desc' }, { createdAt: 'desc' }]
      : ({
          newest:     { createdAt: 'desc' },
          oldest:     { createdAt: 'asc' },
          popular:    { downloadCount: 'desc' },
          mostplayed: { playCount: 'desc' },
          price_low:  { price: 'asc' },
          price_high: { price: 'desc' },
          price_asc:  { price: 'asc' },
          price_desc: { price: 'desc' },
          trending:   { downloads: { _count: 'desc' } },
        }[sortBy] ?? { createdAt: 'desc' });

    const trendingWhere = sortBy === 'trending'
      ? { downloads: { some: { downloadedAt: { gte: sevenDaysAgo } } } }
      : {};

    const skip = (Number(page) - 1) * Number(limit);
    const mergedWhere = { ...where, ...trendingWhere };

    const [total, items] = await Promise.all([
      this.prisma.audioAsset.count({ where: mergedWhere }),
      this.prisma.audioAsset.findMany({
        where: mergedWhere,
        include: {
          category: true,
          tags: { include: { tag: true } },
          musicMetadata: true,
          sfxMetadata: true,
          genres: { include: { genre: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
          wishlists: userId ? { where: { userId } } : false,
          _count: { select: { ratings: true } },
        },
        orderBy,
        skip,
        take: Number(limit),
      }),
    ]);

    // Batch-check which returned sounds the user has already purchased
    let purchasedIds = new Set<string>();
    if (userId && items.length > 0) {
      const soundIds = items.map(s => s.id);
      const purchases = await this.prisma.orderItem.findMany({
        where: {
          audioAssetId: { in: soundIds },
          order: { userId, status: 'PAID' },
        },
        select: { audioAssetId: true },
      });
      purchasedIds = new Set(purchases.map(p => p.audioAssetId));
    }

    return {
      items: items.map((s) => ({
        ...this.formatSound(s, userId, false, false),
        isPurchased: purchasedIds.has(s.id),
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── Single sound ─────────────────────────────────────────

  async findOne(slug: string, userId?: string) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { slug, isPublished: true },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata: true,
        genres: { include: { genre: true } },
        author: { select: { id: true, name: true, avatarUrl: true, bio: true } },
        wishlists: userId ? { where: { userId } } : false,
      },
    });
    if (!sound) throw new NotFoundException('Sound effect not found');

    // Cek apakah user sudah membeli sound ini (untuk PURCHASE access level)
    let isPurchased = false;
    if (userId && sound.accessLevel === 'PURCHASE') {
      const purchase = await this.prisma.orderItem.findFirst({
        where: {
          audioAssetId: sound.id,
          order: { userId, status: 'PAID' },
        },
      });
      isPurchased = !!purchase;
    }

    return { ...this.formatSound(sound, userId), isPurchased };
  }

  // ─── Find by ID (internal) ────────────────────────────────

  async findById(id: string) {
    return this.prisma.audioAsset.findUnique({ where: { id } });
  }

  // ─── Get preview info for streaming ──────────────────────

  async getPreviewInfo(id: string) {
    return this.prisma.audioAsset.findUnique({
      where: { id },
      select: { id: true, previewUrl: true, format: true },
    });
  }

  getLocalPreviewPath(previewUrl: string): string | null {
    return this.storage.getLocalFilePath(previewUrl);
  }

  // ─── Increment play count ────────────────────────────────

  async incrementPlayCount(id: string) {
    await this.prisma.audioAsset.update({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  }

  // ─── Request download ─────────────────────────────────────

  async requestDownload(soundId: string, userId: string) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { id: soundId },
    });
    if (!sound || !sound.isPublished) {
      throw new NotFoundException('Sound effect not found');
    }

    // ── Cek akses ───────────────────────────────────────────

    const alreadyPurchased = await this.prisma.orderItem.findFirst({
      where: {
        audioAssetId: soundId,
        order: { userId, status: 'PAID' },
      },
    });

    // Declare at top scope so it's accessible outside the if block (needsQuotaCheck below)
    // Using any here because Prisma generic syntax on method references is not valid TS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let subscription: any = null;

    if (!alreadyPurchased) {
      subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      const planHierarchy = ['free', 'pro'];
      const accessReq: Record<string, number> = {
        FREE: 0,
        PRO: 1,
        BUSINESS: 1, // treat same as PRO for backward compat
        PURCHASE: 999,
      };
      const required = accessReq[sound.accessLevel] ?? 999;

      if (required === 999) {
        throw new ForbiddenException('This sound must be purchased individually');
      }

      // FREE sounds: izinkan jika user login, bahkan tanpa subscription aktif
      if (required > 0) {
        if (!subscription || subscription.status !== 'ACTIVE') {
          throw new ForbiddenException(
            'An active subscription is required to download this sound. Upgrade your plan.',
          );
        }

        if (subscription.currentPeriodEnd < new Date()) {
          throw new ForbiddenException(
            'Your subscription has expired. Renew your plan to continue downloading.',
          );
        }

        const userLevel = planHierarchy.indexOf(subscription.plan.slug);
        if (userLevel < required) {
          throw new ForbiddenException(
            `This sound requires a ${planHierarchy[required]} plan or higher`,
          );
        }

        // Kuota check dilakukan di dalam transaction (lihat di bawah)
      }
    }

    // ── Tentukan download URL ────────────────────────────────

    let downloadUrl: string;
    let requiresAuth = false;

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    downloadUrl = `${appUrl}/api/v1/sounds/${soundId}/download-stream`;
    requiresAuth = true;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const needsQuotaCheck = !alreadyPurchased && subscription && !subscription.plan.unlimited;

    // FIX (BE-LOGIC-02): Count + create dalam satu Serializable transaction
    // agar tidak bisa race condition bypass download limit.
    const downloadRecord = await this.prisma.$transaction(async (tx) => {
      if (needsQuotaCheck) {
        const now = new Date();
        // Kuota per HARI (bukan per bulan)
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const downloadsToday = await tx.download.count({
          where: { userId, source: 'subscription', downloadedAt: { gte: todayStart } },
        });
        if (downloadsToday >= subscription.plan.downloadLimit) {
          throw new ForbiddenException(
            `Daily download limit reached (${subscription.plan.downloadLimit}x/day). Come back tomorrow or upgrade your plan.`,
          );
        }
      }

      const record = await tx.download.create({
        data: {
          userId,
          audioAssetId: soundId,
          source: alreadyPurchased ? 'purchase' : 'subscription',
          signedUrl: downloadUrl,
          expiresAt,
        },
      });
      await tx.audioAsset.update({
        where: { id: soundId },
        data: { downloadCount: { increment: 1 } },
      });
      return record;
    }, { isolationLevel: 'Serializable' });

    // Fire-and-forget: catat earning untuk creator
    // Skip jika user sudah pernah beli (earnings sudah dicatat saat order paid)
    if (!alreadyPurchased) {
      this.earnings.recordEarning(soundId, downloadRecord.id).catch((err) =>
        this.logger.error(`CRITICAL: recordEarning failed sound=${soundId} download=${downloadRecord.id}: ${err?.message}`, err?.stack),
      );
    }

    return {
      downloadUrl,
      requiresAuth,
      expiresAt,
      fileName: `${sound.slug}-arsonus.zip`,
    };
  }

  // ─── Get local download file path ─────────────────────────

  getLocalDownloadPath(fileUrl: string): string | null {
    return this.storage.getLocalFilePath(fileUrl);
  }

  // ─── Recalculate duration for sounds with durationMs = 0 ──

  async recalculateDuration(soundId: string, requesterId?: string): Promise<{ durationMs: number }> {
    const sound = await this.prisma.audioAsset.findUnique({ where: { id: soundId } });
    if (!sound) throw new NotFoundException('Sound not found');

    if (requesterId) {
      const requester = await this.prisma.user.findUnique({ where: { id: requesterId }, select: { role: true } });
      if (requester?.role !== 'ADMIN' && sound.authorId !== requesterId) {
        throw new ForbiddenException('Only the sound owner or an admin can do this');
      }
    }

    // Baca file dari local storage
    const filePath = this.storage.getLocalFilePath(sound.fileUrl);
    if (!filePath) throw new BadRequestException('File not available on local storage');

    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    const ext = (sound.format || 'wav').toLowerCase();

    const durationMs = await this.audio.getDuration(buffer, ext);

    if (durationMs > 0) {
      await this.prisma.audioAsset.update({
        where: { id: soundId },
        data: { durationMs },
      });
    }

    return { durationMs };
  }

  // ─── Upload SFX baru (author / admin) ────────────────────

  async uploadSound(
    file: Express.Multer.File,
    dto: UploadSoundDto,
    uploaderId: string,
  ) {
    const uploader = await this.prisma.user.findUnique({
      where: { id: uploaderId },
    });
    if (!uploader) throw new ForbiddenException('User not found');

    // Validasi format
    const ext = (file.originalname.split('.').pop() ?? 'wav').toLowerCase();
    const validFormats = ['wav', 'mp3', 'ogg', 'flac'];
    if (!validFormats.includes(ext)) {
      throw new BadRequestException(
        `Unsupported format: ${ext}. Use WAV, MP3, OGG, or FLAC.`,
      );
    }

    // Resolve categoryId dari slug jika diperlukan
    let categoryId = dto.categoryId;
    let resolvedCategory: { id: string; type: string } | null = null;
    if (!categoryId && dto.categorySlug) {
      if (!/^[a-z0-9-]+$/.test(dto.categorySlug)) {
        throw new BadRequestException('Invalid category slug format');
      }
      const cat = await this.prisma.category.findUnique({
        where: { slug: dto.categorySlug },
      });
      if (!cat) throw new BadRequestException(`Category '${dto.categorySlug}' not found`);
      categoryId = cat.id;
      resolvedCategory = { id: cat.id, type: cat.type };
    }
    if (!categoryId) throw new BadRequestException('categoryId or categorySlug is required');
    if (!resolvedCategory) {
      const cat = await this.prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) throw new BadRequestException('Category not found');
      resolvedCategory = { id: cat.id, type: cat.type };
    }

    // Read file from disk (diskStorage) or memory (memoryStorage fallback)
    if (!file.buffer && !file.path) throw new BadRequestException('Audio file not available');
    const fileBuffer: Buffer = file.buffer ?? fs.readFileSync(file.path!);
    const embedded = await this.audio.readEmbeddedMetadata(fileBuffer, ext);
    const title = (dto.title?.trim() || embedded.title || file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')).trim();

    // Generate slug unik
    const slug = dto.slug
      ? await this.ensureUniqueSlug(this.toSlug(dto.slug))
      : await this.ensureUniqueSlug(this.toSlug(title));

    const soundId = uuidv4();

    // Proses audio
    let previewBuffer: Buffer = fileBuffer;
    let waveformData: number[] = this.generateDefaultWaveform();
    let durationMs = 0;

    // ── 1. Durasi: selalu dari header parser (tidak butuh FFmpeg) ─
    try {
      durationMs = await this.audio.getDuration(fileBuffer, ext);
    } catch {
      durationMs = 0;
    }

    // ── 2. Preview + Waveform: pakai FFmpeg (opsional) ─────────
    try {
      const [preview, waveform] = await Promise.all([
        this.audio.generatePreview(fileBuffer, ext),
        this.audio.generateWaveform(fileBuffer, ext),
      ]);
      previewBuffer = preview;
      waveformData = waveform;
    } catch (err: any) {
      this.logger.warn(
        `FFmpeg not available — using original file as preview, fallback waveform. Error: ${err?.message}`,
      );
    }

    // Simpan file
    const fileUrl = await this.storage.uploadAudioFile(
      fileBuffer,
      file.originalname,
      file.mimetype,
    );
    const previewUrl = await this.storage.uploadPreviewFile(
      previewBuffer,
      soundId,
    );

    // Simpan ke database
    const sound = await this.prisma.audioAsset.create({
      data: {
        id: soundId,
        assetType: resolvedCategory.type === 'music' ? 'MUSIC' : 'SFX',
        category: { connect: { id: categoryId! } },
        author: { connect: { id: uploaderId } },
        title,
        slug,
        description: dto.description ?? null,
        fileUrl,
        previewUrl,
        waveformData,
        durationMs,
        fileSize: file.size,
        format: ext,
        price: this.parseOptionalInt(dto.price, 'price') ?? 0,
        accessLevel: (dto.accessLevel ?? 'FREE') as 'FREE' | 'PRO' | 'BUSINESS' | 'PURCHASE',
        licenseType: dto.licenseType ?? 'personal',
        isPublished: false,
        reviewStatus: 'PENDING',
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata: true,
        genres: { include: { genre: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // TODO (BE-01): Replace with Prisma update after running `prisma generate`.
    // Using $executeRaw (parameterized — safe from injection) as a temporary
    // workaround because the Prisma client DLL cannot be regenerated while
    // the server process holds a lock on it (Windows EPERM).
    const musicDto = {
      ...dto,
      bpm: dto.bpm ?? embedded.bpm,
      musicalKey: dto.musicalKey ?? embedded.musicalKey,
      genres: dto.genres ?? embedded.genres?.join(','),
    };

    if (musicDto.bpm !== undefined || musicDto.mood !== undefined || musicDto.musicalKey !== undefined || musicDto.hasStems !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE audio_assets
        SET bpm=${musicDto.bpm ?? null},
            mood=${musicDto.mood ?? null},
            "musicalKey"=${musicDto.musicalKey ?? null},
            "hasStems"=${musicDto.hasStems ?? false}
        WHERE id=${soundId}
      `;
    }
    await this.syncTypedMetadata(soundId, resolvedCategory.type, musicDto);

    // Tags
    if (dto.tags) {
      const tagNames = dto.tags.split(',').map((t) => t.trim()).filter(Boolean);
      for (const name of tagNames) {
        const tagSlug = this.toSlug(name);
        const tag = await this.prisma.tag.upsert({
          where: { slug: tagSlug },
          update: {},
          create: { name, slug: tagSlug },
        });
        await this.prisma.audioAssetOnTag.upsert({
          where: {
            audioAssetId_tagId: { audioAssetId: soundId, tagId: tag.id },
          },
          update: {},
          create: { audioAssetId: soundId, tagId: tag.id },
        });
      }
    }

    // Clean up temp file if diskStorage was used
    if (file.path) {
      try { fs.unlinkSync(file.path); } catch {}
    }

    // Auto-fix durasi jika 0 (fire-and-forget)
    if (durationMs === 0) {
      this.recalculateDuration(soundId).catch(() => {});
    }

    const enriched = await this.prisma.audioAsset.findUnique({
      where: { id: soundId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata: true,
        genres: { include: { genre: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return this.formatSound(enriched ?? sound, uploaderId);
  }

  // ─── Public categories list (for homepage / browse filters) ─

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        type: true,
        _count: { select: { audioAssets: true } },
      },
    });
  }

  // ─── Wishlist ─────────────────────────────────────────────

  async toggleWishlist(soundId: string, userId: string) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { id: soundId },
    });
    if (!sound) throw new NotFoundException('Sound effect not found');

    const existing = await this.prisma.wishlist.findUnique({
      where: { userId_audioAssetId: { userId, audioAssetId: soundId } },
    });

    if (existing) {
      await this.prisma.wishlist.delete({
        where: { userId_audioAssetId: { userId, audioAssetId: soundId } },
      });
      return { liked: false, message: 'Dihapus dari wishlist' };
    }

    await this.prisma.wishlist.create({
      data: { userId, audioAssetId: soundId },
    });
    return { liked: true, message: 'Ditambahkan ke wishlist' };
  }

  async getUserWishlist(userId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);

    const [total, items] = await Promise.all([
      this.prisma.wishlist.count({ where: { userId } }),
      this.prisma.wishlist.findMany({
        where: { userId },
        include: {
          audioAsset: {
            include: {
              category: true,
              tags: { include: { tag: true } },
              musicMetadata: true,
              sfxMetadata: true,
              genres: { include: { genre: true } },
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
    ]);

    return {
      items: items.map((w) => this.formatSound(w.audioAsset, userId, true)),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── Author's sounds ──────────────────────────────────────

  async getAuthorSounds(authorId: string, page = 1, limit = 20) {
    const skip = (Number(page) - 1) * Number(limit);
    const [total, items] = await Promise.all([
      this.prisma.audioAsset.count({ where: { authorId } }),
      this.prisma.audioAsset.findMany({
        where: { authorId },
        include: {
          category: true,
          tags: { include: { tag: true } },
          musicMetadata: true,
          sfxMetadata: true,
          genres: { include: { genre: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
    ]);
    return {
      items: items.map((s) => this.formatSound(s)),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── Related sounds ──────────────────────────────────────

  async findRelated(slug: string, limit = 6) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { slug },
      select: { id: true, categoryId: true },
    });
    if (!sound) return [];

    const items = await this.prisma.audioAsset.findMany({
      where: {
        isPublished: true,
        categoryId: sound.categoryId,
        id: { not: sound.id },
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata: true,
        genres: { include: { genre: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { downloadCount: 'desc' },
      take: Number(limit),
    });

    return items.map(s => this.formatSound(s));
  }

  // ─── Creator analytics ────────────────────────────────────

  async getCreatorAnalytics(authorId: string) {
    const sounds = await this.prisma.audioAsset.findMany({
      where: { authorId },
      select: { id: true, title: true, playCount: true, downloadCount: true, createdAt: true },
      orderBy: { downloadCount: 'desc' },
      take: 10,
    });

    // Downloads per bulan (6 bulan terakhir)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const soundIds = sounds.map(s => s.id);

    const downloads = soundIds.length > 0 ? await this.prisma.download.findMany({
      where: {
        audioAssetId: { in: soundIds },
        downloadedAt: { gte: sixMonthsAgo },
      },
      select: { downloadedAt: true },
      orderBy: { downloadedAt: 'asc' },
    }) : [];

    // Group by month
    const byMonth: Record<string, number> = {};
    downloads.forEach(d => {
      const key = `${d.downloadedAt.getFullYear()}-${String(d.downloadedAt.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      return { month: key, label, downloads: byMonth[key] || 0 };
    });

    return { topSounds: sounds, monthlyDownloads: monthlyData };
  }

  // ─── Download history ─────────────────────────────────────

  async getDownloadHistory(
    userId: string,
    page = 1,
    limit = 20,
    licenseFilter?: string,
    categorySlug?: string,
    search?: string,
    source?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    const soundWhere: any = {};
    if (categorySlug) soundWhere.category = { slug: categorySlug };
    if (search) soundWhere.title = { contains: search, mode: 'insensitive' };

    const where: any = { userId };
    if (source === 'subscription' || source === 'purchase') where.source = source;
    if (Object.keys(soundWhere).length > 0) where.audioAsset = soundWhere;

    const [total, downloads] = await Promise.all([
      this.prisma.download.count({ where }),
      this.prisma.download.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { downloadedAt: 'desc' },
        include: {
          audioAsset: {
            include: {
              category: true,
              author: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    // For purchase downloads, look up licenseType from OrderItem
    const purchaseSoundIds = [...new Set(
      downloads.filter(d => d.source === 'purchase').map(d => d.audioAssetId),
    )];

    const licenseMap: Record<string, string> = {};
    const priceMap: Record<string, number> = {};

    if (purchaseSoundIds.length > 0) {
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          audioAssetId: { in: purchaseSoundIds },
          order: { userId, status: 'PAID' },
        },
        select: { audioAssetId: true, licenseType: true, priceSnapshot: true },
        distinct: ['audioAssetId'],
      });
      orderItems.forEach(oi => {
        licenseMap[oi.audioAssetId] = oi.licenseType;
        priceMap[oi.audioAssetId] = oi.priceSnapshot;
      });
    }

    let items = downloads.map(d => ({
      id: d.id,
      soundId: d.audioAssetId,
      soundTitle: d.audioAsset.title,
      soundSlug: d.audioAsset.slug,
      soundFormat: d.audioAsset.format,
      previewUrl: d.audioAsset.previewUrl,
      categoryName: d.audioAsset.category.name,
      categorySlug: d.audioAsset.category.slug,
      authorName: (d.audioAsset as any).author?.name ?? null,
      authorId: (d.audioAsset as any).author?.id ?? null,
      source: d.source,
      licenseType: d.source === 'subscription'
        ? 'personal'
        : (licenseMap[d.audioAssetId] ?? 'personal'),
      priceAtPurchase: d.source === 'purchase' ? (priceMap[d.audioAssetId] ?? 0) : null,
      downloadedAt: d.downloadedAt,
    }));

    // Apply license filter client-side after enrichment
    if (licenseFilter && licenseFilter !== 'all') {
      items = items.filter(i => i.licenseType === licenseFilter);
    }

    return {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── Format response ──────────────────────────────────────

  private formatSound(sound: any, userId?: string, forceIsLiked?: boolean, slimList = false) {
    const isLiked =
      forceIsLiked ??
      (userId && sound.wishlists ? sound.wishlists.length > 0 : false);

    return {
      id: sound.id,
      assetType: sound.assetType ?? (sound.category?.type === 'music' ? 'MUSIC' : 'SFX'),
      title: sound.title,
      slug: sound.slug,
      description: sound.description,
      previewUrl: sound.previewUrl,
      waveformData: slimList ? undefined : sound.waveformData,
      durationMs: sound.durationMs,
      format: sound.format,
      fileSize: sound.fileSize,
      price: sound.price,
      isFree: sound.price === 0,
      accessLevel: sound.accessLevel,
      licenseType: sound.licenseType,
      isLiked,
      isPublished: sound.isPublished,
      reviewStatus: sound.reviewStatus,
      reviewNote: sound.reviewNote,
      playCount: sound.playCount,
      downloadCount: sound.downloadCount,
      bpm: sound.musicMetadata?.bpm ?? (sound as any).bpm ?? null,
      mood: sound.musicMetadata?.mood ?? (sound as any).mood ?? null,
      musicalKey: sound.musicMetadata?.musicalKey ?? (sound as any).musicalKey ?? null,
      hasStems: sound.musicMetadata?.hasStems ?? (sound as any).hasStems ?? false,
      category: sound.category,
      tags: sound.tags?.map((t: any) => t.tag) ?? [],
      genres: sound.genres?.map((g: any) => g.genre) ?? [],
      sfxMetadata: sound.sfxMetadata ?? null,
      musicMetadata: sound.musicMetadata ?? null,
      author: sound.author ?? null,
      publishedAt: sound.publishedAt,
      createdAt: sound.createdAt,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/-+/g, '-');
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let counter = 1;
    while (await this.prisma.audioAsset.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private generateDefaultWaveform(bars = 100): number[] {
    return Array.from({ length: bars }, () =>
      Math.floor(Math.random() * 20) + 4,
    );
  }

  private parseGenreSlugs(input?: string | string[]): string[] {
    const values = Array.isArray(input) ? input : (input ?? '').split(',');
    return [...new Set(values.map((g) => this.toSlug(String(g).trim())).filter(Boolean))].slice(0, 12);
  }

  private genreNameFromSlug(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private async syncTypedMetadata(
    audioAssetId: string,
    categoryType: string,
    dto: {
      bpm?: number;
      mood?: string;
      musicalKey?: string;
      hasStems?: boolean;
      genres?: string | string[];
    },
  ) {
    if (categoryType === 'music') {
      const update: any = {};
      if (dto.bpm !== undefined) update.bpm = dto.bpm ?? null;
      if (dto.mood !== undefined) update.mood = dto.mood ?? null;
      if (dto.musicalKey !== undefined) update.musicalKey = dto.musicalKey ?? null;
      if (dto.hasStems !== undefined) update.hasStems = dto.hasStems ?? false;

      await this.prisma.musicMetadata.upsert({
        where: { assetId: audioAssetId },
        update,
        create: {
          assetId: audioAssetId,
          bpm: dto.bpm ?? null,
          mood: dto.mood ?? null,
          musicalKey: dto.musicalKey ?? null,
          hasStems: dto.hasStems ?? false,
        },
      });
      await this.prisma.sfxMetadata.deleteMany({ where: { assetId: audioAssetId } });
      if (dto.genres !== undefined) {
        await this.syncGenres(audioAssetId, this.parseGenreSlugs(dto.genres));
      }
      return;
    }

    await this.prisma.sfxMetadata.upsert({
      where: { assetId: audioAssetId },
      update: {},
      create: { assetId: audioAssetId },
    });
    await this.prisma.musicMetadata.deleteMany({ where: { assetId: audioAssetId } });
    await this.prisma.audioAssetGenre.deleteMany({ where: { assetId: audioAssetId } });
  }

  private async syncGenres(audioAssetId: string, genreSlugs: string[]) {
    await this.prisma.audioAssetGenre.deleteMany({ where: { assetId: audioAssetId } });
    if (genreSlugs.length === 0) return;

    const genres = await Promise.all(
      genreSlugs.map((slug) =>
        this.prisma.genre.upsert({
          where: { slug },
          update: {},
          create: { slug, name: this.genreNameFromSlug(slug) },
        }),
      ),
    );

    await this.prisma.audioAssetGenre.createMany({
      data: genres.map((genre) => ({ assetId: audioAssetId, genreId: genre.id })),
      skipDuplicates: true,
    });
  }

  // ─── Update sound (owner or admin) ───────────────────────

  async updateSound(
    userId: string,
    soundId: string,
    dto: UpdateSoundDto,
    isAdmin = false,
  ) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { id: soundId },
    });
    if (!sound) throw new NotFoundException('Sound effect not found');
    if (!isAdmin && sound.authorId !== userId) {
      throw new ForbiddenException('You do not have permission to edit this sound');
    }

    const updateData: any = {};

    if (dto.title !== undefined) {
      const baseSlug = this.toSlug(dto.title);
      const slug = sound.title === dto.title
        ? sound.slug
        : await this.ensureUniqueSlug(baseSlug);
      updateData.title = dto.title;
      updateData.slug = slug;
    }
    if (dto.description !== undefined) updateData.description = dto.description;

    const price = this.parseOptionalInt(dto.price, 'price');
    const priceChanged = price !== undefined && price !== sound.price;
    const accessLevelChanged = dto.accessLevel !== undefined && dto.accessLevel !== sound.accessLevel;

    if (price !== undefined) updateData.price = price;
    if (dto.accessLevel !== undefined) updateData.accessLevel = dto.accessLevel;

    if (dto.categorySlug !== undefined) {
      const cat = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
      if (!cat) throw new BadRequestException('Category not found');
      updateData.categoryId = cat.id;
      updateData.assetType = cat.type === 'music' ? 'MUSIC' : 'SFX';
    }

    // Non-admin: any edit to an approved sound requires re-review before going live
    if (!isAdmin && sound.reviewStatus === 'APPROVED') {
      updateData.reviewStatus = 'NEEDS_RE_REVIEW';
      updateData.isPublished = false;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.audioAsset.update({
        where: { id: soundId },
        data: updateData,
        include: {
          category: true,
          tags: { include: { tag: true } },
          musicMetadata: true,
          sfxMetadata: true,
          genres: { include: { genre: true } },
        },
      });

      if (dto.tags !== undefined) {
        const tagSlugs: string[] = Array.isArray(dto.tags)
          ? dto.tags
          : (dto.tags as string).split(',').map(t => t.trim()).filter(Boolean);
        await tx.audioAssetOnTag.deleteMany({ where: { audioAssetId: soundId } });
        if (tagSlugs.length > 0) {
          const upserted = await Promise.all(
            tagSlugs.map((slug) =>
              tx.tag.upsert({
                where: { slug },
                update: {},
                create: {
                  slug,
                  name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                },
              }),
            ),
          );
          await tx.audioAssetOnTag.createMany({
            data: upserted.map((t) => ({ audioAssetId: soundId, tagId: t.id })),
          });
        }
      }

      return tx.audioAsset.findUnique({
        where: { id: soundId },
        include: {
          category: true,
          tags: { include: { tag: true } },
          musicMetadata: true,
          sfxMetadata: true,
          genres: { include: { genre: true } },
        },
      });
    });

    // TODO (BE-01): Replace with Prisma update after `prisma generate`.
    if (dto.bpm !== undefined || dto.mood !== undefined || dto.musicalKey !== undefined || dto.hasStems !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE audio_assets
        SET bpm=${dto.bpm ?? null},
            mood=${dto.mood ?? null},
            "musicalKey"=${dto.musicalKey ?? null},
            "hasStems"=${dto.hasStems ?? false}
        WHERE id=${soundId}
      `;
    }
    if (updated?.category?.type && (
      dto.categorySlug !== undefined ||
      dto.bpm !== undefined ||
      dto.mood !== undefined ||
      dto.musicalKey !== undefined ||
      dto.hasStems !== undefined ||
      dto.genres !== undefined
    )) {
      await this.syncTypedMetadata(soundId, updated.category.type, dto);
    }

    return this.prisma.audioAsset.findUnique({
      where: { id: soundId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata: true,
        genres: { include: { genre: true } },
      },
    });
  }

  // ─── Resubmit rejected sound ─────────────────────────────────
  async resubmitSound(
    userId: string,
    soundId: string,
    dto: UpdateSoundDto,
    file?: Express.Multer.File,
  ) {
    const sound = await this.prisma.audioAsset.findUnique({
      where: { id: soundId },
      include: { category: true },
    });
    if (!sound) throw new NotFoundException('Sound not found');
    if (sound.authorId !== userId) {
      throw new ForbiddenException('You do not own this sound');
    }
    if (sound.reviewStatus !== 'REJECTED') {
      throw new BadRequestException('Only REJECTED sounds can be resubmitted');
    }

    const updateData: any = {
      reviewStatus: 'PENDING',
      reviewNote:   null,
      isPublished:  false,
    };

    if (dto.title       !== undefined) {
      updateData.title = dto.title;
      if (dto.title !== sound.title) {
        updateData.slug = await this.ensureUniqueSlug(this.toSlug(dto.title));
      }
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    const price = this.parseOptionalInt(dto.price, 'price');
    if (price           !== undefined) updateData.price       = price;
    if (dto.accessLevel !== undefined) updateData.accessLevel = dto.accessLevel;

    if (dto.categorySlug !== undefined) {
      const cat = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
      if (!cat) throw new BadRequestException('Category not found');
      updateData.categoryId = cat.id;
      updateData.assetType = cat.type === 'music' ? 'MUSIC' : 'SFX';
    }

    // Optional: replace audio file
    if (file) {
      const ext = (file.originalname.split('.').pop() ?? 'wav').toLowerCase();
      const validFormats = ['wav', 'mp3', 'ogg', 'flac'];
      if (!validFormats.includes(ext)) {
        throw new BadRequestException(`Unsupported format: ${ext}. Use WAV, MP3, OGG, or FLAC.`);
      }

      const fileBuffer: Buffer = file.buffer ?? fs.readFileSync(file.path!);
      let previewBuffer: Buffer = fileBuffer;
      let waveformData: number[] = this.generateDefaultWaveform();
      let durationMs = 0;

      try { durationMs = await this.audio.getDuration(fileBuffer, ext); } catch {}
      try {
        const [preview, waveform] = await Promise.all([
          this.audio.generatePreview(fileBuffer, ext),
          this.audio.generateWaveform(fileBuffer, ext),
        ]);
        previewBuffer = preview;
        waveformData  = waveform;
      } catch (err: any) {
        this.logger.warn(`FFmpeg unavailable during resubmit: ${err?.message}`);
      }

      const fileUrl    = await this.storage.uploadAudioFile(fileBuffer, file.originalname, file.mimetype);
      const previewUrl = await this.storage.uploadPreviewFile(previewBuffer, soundId);

      updateData.fileUrl      = fileUrl;
      updateData.previewUrl   = previewUrl;
      updateData.waveformData = waveformData;
      updateData.durationMs   = durationMs;
      updateData.fileSize     = file.size;
      updateData.format       = ext;

      if (file.path) { try { fs.unlinkSync(file.path); } catch {} }
      if (durationMs === 0) this.recalculateDuration(soundId).catch(() => {});
    }

    await this.prisma.audioAsset.update({ where: { id: soundId }, data: updateData });

    // Sync tags — normalize (FormData = string, JSON = string[])
    if (dto.tags !== undefined) {
      const tagSlugs: string[] = Array.isArray(dto.tags)
        ? dto.tags
        : (dto.tags as string).split(',').map(t => t.trim()).filter(Boolean);

      await this.prisma.audioAssetOnTag.deleteMany({ where: { audioAssetId: soundId } });
      for (const tagSlug of tagSlugs) {
        const tag = await this.prisma.tag.upsert({
          where:  { slug: tagSlug },
          update: {},
          create: { slug: tagSlug, name: tagSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
        });
        await this.prisma.audioAssetOnTag.upsert({
          where:  { audioAssetId_tagId: { audioAssetId: soundId, tagId: tag.id } },
          update: {},
          create: { audioAssetId: soundId, tagId: tag.id },
        });
      }
    }

    // Sync typed metadata & genres
    const catType = (updateData.categoryId
      ? (await this.prisma.category.findUnique({ where: { id: updateData.categoryId } }))?.type
      : sound.category?.type) ?? 'sfx';
    await this.syncTypedMetadata(soundId, catType, dto);

    return this.prisma.audioAsset.findUnique({
      where: { id: soundId },
      include: {
        category: true,
        tags: { include: { tag: true } },
        musicMetadata: true,
        sfxMetadata:   true,
        genres: { include: { genre: true } },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }
}
