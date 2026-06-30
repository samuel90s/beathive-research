// src/recommendations/collaborative-filtering.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CfScore {
  audioAssetId: string;
  cfScore: number; // normalized [0, 1]
  source: 'item-item' | 'user-user';
}

/**
 * Collaborative Filtering service.
 *
 * Two strategies to complement Content-Based Filtering:
 *
 * 1. Item-Item CF (co-occurrence)
 *    Scores candidates by how often they co-occur with items the target
 *    user has strongly interacted with.
 *    coScore(A,B) = |users(A) ∩ users(B)| / sqrt(|users(A)| × |users(B)|)
 *
 * 2. User-User CF (neighborhood)
 *    Finds users with overlapping interaction history, then surfaces items
 *    those neighbors liked that the target user hasn't seen.
 *    sim(U,V) = overlap / sqrt(|items(U)| × |items(V)|)
 *
 * Both return normalized scores in [0, 1].
 */
@Injectable()
export class CollaborativeFilteringService {
  private static readonly STRONG_ACTIONS = ['purchase', 'download', 'wishlist', 'play_long'];

  constructor(private prisma: PrismaService) {}

  /**
   * Item-Item CF: score each candidate by co-occurrence with the user's anchor items.
   */
  async itemItemScores(
    userId: string,
    candidateIds: string[],
  ): Promise<Map<string, number>> {
    if (candidateIds.length === 0) return new Map();

    const anchorLogs = await this.prisma.userBehaviorLog.findMany({
      where: { userId, action: { in: CollaborativeFilteringService.STRONG_ACTIONS }, audioAssetId: { not: null } },
      select: { audioAssetId: true },
      distinct: ['audioAssetId'],
    });

    const anchorIds = anchorLogs.map(l => l.audioAssetId!).filter(Boolean);
    if (anchorIds.length === 0) return new Map();

    const coInteractions = await this.prisma.userBehaviorLog.findMany({
      where: { audioAssetId: { in: anchorIds }, userId: { not: userId }, action: { in: CollaborativeFilteringService.STRONG_ACTIONS } },
      select: { userId: true, audioAssetId: true },
      distinct: ['userId', 'audioAssetId'],
    });

    const coUserItems = new Map<string, Set<string>>();
    for (const r of coInteractions) {
      if (!coUserItems.has(r.userId)) coUserItems.set(r.userId, new Set());
      coUserItems.get(r.userId)!.add(r.audioAssetId!);
    }

    const anchorSet = new Set(anchorIds);
    const candidateSet = new Set(candidateIds);
    const rawScores = new Map<string, number>();

    for (const [, items] of coUserItems) {
      const overlap = [...items].filter(id => anchorSet.has(id));
      if (overlap.length === 0) continue;
      for (const candidateId of items) {
        if (!candidateSet.has(candidateId) || anchorSet.has(candidateId)) continue;
        const score = overlap.length / Math.sqrt(anchorIds.length * items.size);
        rawScores.set(candidateId, (rawScores.get(candidateId) ?? 0) + score);
      }
    }

    return this.normalizeScores(rawScores);
  }

  /**
   * User-User CF: find similar users and return items they liked
   * that the target user hasn't interacted with.
   */
  async userUserItems(userId: string, limit = 30): Promise<CfScore[]> {
    const targetLogs = await this.prisma.userBehaviorLog.findMany({
      where: { userId, action: { in: CollaborativeFilteringService.STRONG_ACTIONS }, audioAssetId: { not: null } },
      select: { audioAssetId: true },
      distinct: ['audioAssetId'],
    });

    const targetItemIds = new Set(targetLogs.map(l => l.audioAssetId!));
    if (targetItemIds.size === 0) return [];

    const overlappingLogs = await this.prisma.userBehaviorLog.findMany({
      where: { audioAssetId: { in: [...targetItemIds] }, userId: { not: userId }, action: { in: CollaborativeFilteringService.STRONG_ACTIONS } },
      select: { userId: true, audioAssetId: true },
      distinct: ['userId', 'audioAssetId'],
    });

    const neighborOverlap = new Map<string, number>();
    for (const r of overlappingLogs) {
      neighborOverlap.set(r.userId, (neighborOverlap.get(r.userId) ?? 0) + 1);
    }

    const qualifiedNeighbors = [...neighborOverlap.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([uid]) => uid);

    if (qualifiedNeighbors.length === 0) return [];

    const neighborLogs = await this.prisma.userBehaviorLog.findMany({
      where: { userId: { in: qualifiedNeighbors }, audioAssetId: { notIn: [...targetItemIds] }, action: { in: CollaborativeFilteringService.STRONG_ACTIONS } },
      select: { userId: true, audioAssetId: true },
      distinct: ['userId', 'audioAssetId'],
    });

    const itemScores = new Map<string, number>();
    for (const r of neighborLogs) {
      const overlap = neighborOverlap.get(r.userId) ?? 0;
      const neighborItems = overlappingLogs.filter(l => l.userId === r.userId).length;
      const sim = overlap / Math.sqrt(targetItemIds.size * (neighborItems + overlap));
      itemScores.set(r.audioAssetId!, (itemScores.get(r.audioAssetId!) ?? 0) + sim);
    }

    const normalizedScores = this.normalizeScores(itemScores);
    return [...normalizedScores.entries()]
      .map(([audioAssetId, cfScore]) => ({ audioAssetId, cfScore, source: 'user-user' as const }))
      .sort((a, b) => b.cfScore - a.cfScore)
      .slice(0, limit);
  }

  private normalizeScores(scores: Map<string, number>): Map<string, number> {
    if (scores.size === 0) return scores;
    const max = Math.max(...scores.values());
    if (max === 0) return scores;
    const result = new Map<string, number>();
    for (const [k, v] of scores) result.set(k, v / max);
    return result;
  }
}
