// src/recommendations/bandit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Thompson Sampling bandit for recommendation exploration/exploitation.
 *
 * Each audio asset has a Beta(α, β) distribution over its estimated
 * click-through probability:
 *  - α increments on positive interactions (play, wishlist, purchase)
 *  - β increments on impressions without interaction
 *
 * Items with few impressions get high variance (exploration).
 * Items with consistent conversions get high mean (exploitation).
 *
 * Bandit score is mixed with CBF/CF content score:
 *   finalScore = (1 − BANDIT_WEIGHT) × contentScore + BANDIT_WEIGHT × banditSample
 */
@Injectable()
export class BanditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sample from each item's Beta(α, β) distribution.
   * Unknown items default to Beta(1, 1) — uniform prior.
   */
  async sampleScores(audioAssetIds: string[]): Promise<Map<string, number>> {
    if (audioAssetIds.length === 0) return new Map();

    const states = await this.prisma.banditState.findMany({
      where: { audioAssetId: { in: audioAssetIds } },
      select: { audioAssetId: true, alpha: true, beta: true },
    });

    const stateMap = new Map(states.map(s => [s.audioAssetId, s]));
    const scores = new Map<string, number>();

    for (const id of audioAssetIds) {
      const state = stateMap.get(id);
      scores.set(id, this.sampleBeta(state?.alpha ?? 1, state?.beta ?? 1));
    }

    return scores;
  }

  /** Record an impression (item was shown). Increments β. */
  async recordImpression(audioAssetId: string): Promise<void> {
    await this.prisma.banditState.upsert({
      where: { audioAssetId },
      update: { beta: { increment: 1 }, impressions: { increment: 1 } },
      create: { audioAssetId, alpha: 1.0, beta: 2.0, impressions: 1, conversions: 0 },
    });
  }

  /** Record a conversion (user engaged after seeing recommendation). Increments α. */
  async recordConversion(audioAssetId: string): Promise<void> {
    await this.prisma.banditState.upsert({
      where: { audioAssetId },
      update: { alpha: { increment: 1 }, conversions: { increment: 1 } },
      create: { audioAssetId, alpha: 2.0, beta: 1.0, impressions: 1, conversions: 1 },
    });
  }

  /** Batch record impressions. Errors are swallowed — non-critical. */
  async recordImpressions(audioAssetIds: string[]): Promise<void> {
    try {
      await Promise.all(audioAssetIds.map(id => this.recordImpression(id)));
    } catch {
      // impression logging is best-effort
    }
  }

  // ── Beta Distribution Sampler ─────────────────────────────────────────────────

  /**
   * Sample from Beta(α, β) via the Gamma ratio method:
   *   Beta(α, β) = Gamma(α) / (Gamma(α) + Gamma(β))
   */
  sampleBeta(alpha: number, beta: number): number {
    const x = this.sampleGamma(Math.max(alpha, 0.001));
    const y = this.sampleGamma(Math.max(beta, 0.001));
    if (x + y === 0) return 0.5;
    return x / (x + y);
  }

  /** Sample from Gamma(shape, 1) using Marsaglia & Tsang's method. */
  private sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(1 + shape) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do {
        x = this.sampleStandardNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /** Box-Muller standard normal sample. */
  private sampleStandardNormal(): number {
    const u = Math.max(1e-10, Math.random());
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
