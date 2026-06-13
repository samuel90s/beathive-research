import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private prisma: PrismaService) {}

  async createOrUpdate(userId: string, audioAssetId: string, score: number, reviewText?: string) {
    if (score < 1 || score > 5) throw new BadRequestException('Score must be between 1 and 5');

    const sound = await this.prisma.audioAsset.findUnique({ where: { id: audioAssetId } });
    if (!sound || !sound.isPublished) throw new NotFoundException('Sound not found');

    return this.prisma.rating.upsert({
      where: { userId_audioAssetId: { userId, audioAssetId } },
      update: { score, reviewText: reviewText ?? null },
      create: { userId, audioAssetId, score, reviewText: reviewText ?? null },
    });
  }

  async getSoundRatings(audioAssetId: string) {
    const [ratings, agg] = await Promise.all([
      this.prisma.rating.findMany({
        where: { audioAssetId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.rating.aggregate({
        where: { audioAssetId },
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);

    const distribution = [5, 4, 3, 2, 1].map(s => ({
      score: s,
      count: ratings.filter(r => r.score === s).length,
    }));

    return {
      avgScore: agg._avg.score ? Math.round(agg._avg.score * 10) / 10 : 0,
      totalCount: agg._count.score,
      distribution,
      reviews: ratings,
    };
  }

  async getUserRating(userId: string, audioAssetId: string) {
    return this.prisma.rating.findUnique({
      where: { userId_audioAssetId: { userId, audioAssetId } },
    });
  }

  async deleteRating(userId: string, audioAssetId: string) {
    const existing = await this.prisma.rating.findUnique({
      where: { userId_audioAssetId: { userId, audioAssetId } },
    });
    if (!existing) throw new NotFoundException('Rating not found');
    await this.prisma.rating.delete({ where: { userId_audioAssetId: { userId, audioAssetId } } });
    return { ok: true };
  }
}
