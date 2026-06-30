// src/recommendations/recommendations.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService, BatchEvaluationResult } from './evaluation.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { BanditService } from './bandit.service';

// ─── Scoring Constants ────────────────────────────────────────────────────────

const BEHAVIOR_WEIGHTS: Record<string, number> = {
  search: 1,
  click: 2,
  play: 3,
  play_long: 4,
  wishlist: 4,
  cart: 5,
  download: 6,
  purchase: 6,
};

/** Minimum interaction weight before we trust user preferences */
const COLD_START_LIMIT = 20;

/** Time-decay rate λ for behavior logs: e^(-λ × age_days). λ=0.02 → 30-day half-life ≈ 55% */
const DECAY_LAMBDA = 0.02;

/** Hacker-News–style gravity for trending time-decay */
const TRENDING_GRAVITY = 1.5;

/** Maximum number of behavior logs per user (90-day sliding window) */
const MAX_BEHAVIOR_LOGS = 200;

// ─── Feature Weights ──────────────────────────────────────────────────────────

/** Weight multipliers for building preference + item vectors */
const W_CATEGORY = 3.0;
const W_SUBCATEGORY = 2.5;
const W_TAG = 2.0;
const W_MOOD = 1.5;

/** Bonuses added on top of cosine similarity */
const W_BPM = 0.08;         // Max BPM similarity bonus
const W_KEY = 0.05;         // Max musical-key compatibility bonus
const W_DURATION = 0.04;    // Max duration-bucket match bonus
const W_POPULARITY = 0.05;  // Max popularity boost

/** New-item cold-start max boost (metadata quality × recency decay) */
const NEW_ITEM_MAX_BOOST = 0.12;
const NEW_ITEM_AGE_DAYS = 7;

// ─── Hybrid Scoring ───────────────────────────────────────────────────────────

/** CBF vs CF blend — 70% content-based, 30% collaborative */
const CBF_WEIGHT = 0.7;
const CF_WEIGHT = 0.3;

/** Bandit exploration weight blended into final score */
const BANDIT_WEIGHT = 0.1;

// ─── MMR (Diversity) ──────────────────────────────────────────────────────────

/**
 * λ in Maximal Marginal Relevance.
 * 1.0 = pure relevance (no diversity), 0.0 = pure diversity.
 */
const MMR_LAMBDA = 0.7;

// ─── Pre-filter Pool ──────────────────────────────────────────────────────────

const TOP_CATEGORY_FILTER = 5;
const TOP_TAG_FILTER = 15;
const MIN_CANDIDATE_POOL = 50;

// ─── Session Blending ─────────────────────────────────────────────────────────

/** Session signal weight when blending session + historical vectors */
const SESSION_BLEND_RATIO = 0.4;

// ─── Shared Prisma select ─────────────────────────────────────────────────────

const ASSET_SELECT = {
  id: true,
  title: true,
  slug: true,
  previewUrl: true,
  waveformData: true,
  durationMs: true,
  price: true,
  accessLevel: true,
  format: true,
  playCount: true,
  downloadCount: true,
  mood: true,
  bpm: true,
  musicalKey: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  sfxMetadata: { select: { subcategory: true } },
} as const;

// ─── Musical Key Compatibility ────────────────────────────────────────────────

/** Circle-of-fifths order (major keys) for harmonic distance computation */
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface RecommendedSound {
  id: string;
  title: string;
  slug: string;
  previewUrl: string;
  waveformData: number[];
  durationMs: number;
  price: number;
  accessLevel: string;
  format: string;
  playCount: number;
  downloadCount: number;
  category: { id: string; name: string; slug: string; icon?: string | null };
  tags: { id: string; name: string; slug: string }[];
  mood?: string | null;
  bpm?: number | null;
  similarityScore: number;
  reason: string;
}

export interface TasteProfile {
  topCategories: { slug: string; name: string; score: number }[];
  topTags: { slug: string; name: string; score: number }[];
  topMoods: { mood: string; score: number }[];
  topSubcategories: { slug: string; name: string; score: number }[];
  avgBpm: number | null;
  topKeys: { key: string; score: number }[];
  totalInteractions: number;
}

export interface PersonalizedResult {
  items: RecommendedSound[];
  isColdStart: boolean;
  tasteProfile: TasteProfile | null;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

export type UserVector = {
  categoryWeights: Map<string, number>;
  tagWeights: Map<string, number>;
  moodWeights: Map<string, number>;
  subcategoryWeights: Map<string, number>;
  musicalKeyWeights: Map<string, number>;
  avgBpm: number | null;
  durationBucketWeights: Map<string, number>;
  totalWeight: number;
  reason: string;
};

type AssetForScoring = {
  id: string;
  title: string;
  slug: string;
  previewUrl: string;
  waveformData: unknown;
  durationMs: number;
  price: number;
  accessLevel: string;
  format: string;
  playCount: number;
  downloadCount: number;
  mood: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  category: { id: string; name: string; slug: string; icon?: string | null };
  tags: { tag: { id: string; name: string; slug: string } }[];
  sfxMetadata?: { subcategory: string | null } | null;
};

type ScoredAsset = AssetForScoring & { score: number };

// ─── Duration Buckets ─────────────────────────────────────────────────────────

type DurationBucket = 'micro' | 'short' | 'medium' | 'long' | 'ambient';

function getDurationBucket(ms: number): DurationBucket {
  if (ms < 2_000) return 'micro';   // < 2s: clicks, stings
  if (ms < 10_000) return 'short';  // 2–10s: SFX
  if (ms < 30_000) return 'medium'; // 10–30s: loops
  if (ms < 120_000) return 'long';  // 30s–2min: music
  return 'ambient';                  // > 2min: ambient / bgm
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationsService {
  /** In-memory IDF cache (refreshed every hour) */
  private tagIdfCache: Map<string, number> | null = null;
  private tagIdfCachedAt = 0;
  private readonly TAG_IDF_TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluationService: EvaluationService,
    private readonly cfService: CollaborativeFilteringService,
    private readonly banditService: BanditService,
  ) {}

  // ── Behavior Logging ──────────────────────────────────────────────────────────

  async logBehavior(
    userId: string,
    action: string,
    data: {
      audioAssetId?: string;
      searchQuery?: string;
      categorySlug?: string;
      sessionId?: string;
    },
  ) {
    const weight = BEHAVIOR_WEIGHTS[action] ?? 1;
    let tagSlugs: string[] = [];
    let moodValue: string | undefined;
    let categorySlug = data.categorySlug;

    if (data.audioAssetId) {
      const asset = await this.prisma.audioAsset.findUnique({
        where: { id: data.audioAssetId },
        select: {
          tags: { select: { tag: { select: { slug: true } } } },
          mood: true,
          category: { select: { slug: true } },
        },
      });
      if (asset) {
        tagSlugs = asset.tags.map(t => t.tag.slug);
        moodValue = asset.mood ?? undefined;
        categorySlug = categorySlug ?? asset.category.slug;
      }

      // Record bandit conversion for positive actions
      if (['play', 'play_long', 'wishlist', 'purchase', 'download'].includes(action)) {
        this.banditService.recordConversion(data.audioAssetId).catch(() => {});
      }
    }

    await this.prisma.userBehaviorLog.create({
      data: {
        userId,
        audioAssetId: data.audioAssetId ?? null,
        action,
        weight,
        searchQuery: data.searchQuery ?? null,
        categorySlug: categorySlug ?? null,
        tagSlugs,
        moodValue: moodValue ?? null,
        sessionId: data.sessionId ?? null,
      },
    });
  }

  // ── TF-IDF Tag IDF Cache ──────────────────────────────────────────────────────

  /**
   * Computes and caches Inverse Document Frequency for all tags.
   * IDF(t) = log((N + 1) / (df_t + 1)) + 1   (smoothed to avoid zero)
   *
   * Rare tags score higher → more discriminative signal for recommendation.
   */
  private async getTagIdf(): Promise<Map<string, number>> {
    if (this.tagIdfCache && Date.now() - this.tagIdfCachedAt < this.TAG_IDF_TTL_MS) {
      return this.tagIdfCache;
    }
    const [totalSounds, tagFreqs] = await Promise.all([
      this.prisma.audioAsset.count({ where: { isPublished: true } }),
      this.prisma.tag.findMany({
        select: { slug: true, _count: { select: { audioAssets: true } } },
      }),
    ]);
    const idf = new Map<string, number>();
    for (const tag of tagFreqs) {
      const df = tag._count.audioAssets;
      idf.set(tag.slug, Math.log((totalSounds + 1) / (df + 1)) + 1);
    }
    this.tagIdfCache = idf;
    this.tagIdfCachedAt = Date.now();
    return idf;
  }

  // ── User Vector Construction ──────────────────────────────────────────────────

  /**
   * Builds a comprehensive user preference vector from:
   *  1. Behavior logs with time-decay (implicit feedback)
   *  2. TF-IDF weighted tag signals
   *  3. Positive ratings ≥ 4★ (explicit feedback)
   *  4. SfxMetadata subcategories of interacted assets
   *  5. BPM average and musical key preferences
   *  6. Duration bucket preferences
   */
  async buildUserVector(userId: string): Promise<UserVector> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [logs, positiveRatings, tagIdf] = await Promise.all([
      this.prisma.userBehaviorLog.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: MAX_BEHAVIOR_LOGS,
      }),
      this.prisma.rating.findMany({
        where: { userId, score: { gte: 4 } },
        select: {
          score: true,
          audioAsset: {
            select: {
              category: { select: { slug: true } },
              tags: { select: { tag: { select: { slug: true } } } },
              mood: true,
              bpm: true,
              musicalKey: true,
              durationMs: true,
              sfxMetadata: { select: { subcategory: true } },
            },
          },
        },
      }),
      this.getTagIdf(),
    ]);

    // Batch-fetch metadata of interacted assets in one query
    const interactedIds = [...new Set(logs.filter(l => l.audioAssetId).map(l => l.audioAssetId!))];
    const interactedMeta = interactedIds.length > 0
      ? await this.prisma.audioAsset.findMany({
          where: { id: { in: interactedIds } },
          select: {
            id: true,
            bpm: true,
            musicalKey: true,
            durationMs: true,
            sfxMetadata: { select: { subcategory: true } },
          },
        })
      : [];

    const assetMetaById = new Map(interactedMeta.map(a => [a.id, a]));

    // ── Build weights ──────────────────────────────────────────────────────────

    const categoryWeights = new Map<string, number>();
    const tagWeights = new Map<string, number>();
    const moodWeights = new Map<string, number>();
    const subcategoryWeights = new Map<string, number>();
    const musicalKeyWeights = new Map<string, number>();
    const durationBucketWeights = new Map<string, number>();
    let totalWeight = 0;
    let strongestReason = 'Recommended for you';
    let strongestReasonWeight = 0;

    // Track BPM for weighted average
    let bpmWeightedSum = 0;
    let bpmTotalWeight = 0;

    // 1. Process behavior logs with time-decay
    for (const log of logs) {
      const ageInDays = (Date.now() - log.createdAt.getTime()) / 86_400_000;
      // Time-decay: recent interactions matter more
      const decayedWeight = log.weight * Math.exp(-DECAY_LAMBDA * ageInDays);
      totalWeight += decayedWeight;

      const reasonTerm = log.moodValue ?? log.categorySlug ?? log.tagSlugs[0] ?? log.searchQuery;
      if (reasonTerm && decayedWeight >= strongestReasonWeight) {
        strongestReasonWeight = decayedWeight;
        strongestReason = `Because you ${this.actionLabel(log.action)} ${this.humanize(reasonTerm)}`;
      }

      if (log.categorySlug) this.addW(categoryWeights, log.categorySlug, decayedWeight);

      for (const tag of log.tagSlugs) {
        // TF-IDF: multiply tag weight by its IDF score (rare tags → higher signal)
        const idf = tagIdf.get(tag) ?? 1;
        this.addW(tagWeights, tag, decayedWeight * idf);
      }

      if (log.searchQuery) {
        for (const term of this.tokenize(log.searchQuery)) {
          if (this.isMoodTerm(term)) this.addW(moodWeights, term, decayedWeight);
          else {
            const idf = tagIdf.get(term) ?? 1;
            this.addW(tagWeights, term, decayedWeight * idf);
          }
        }
      }

      if (log.moodValue) this.addW(moodWeights, log.moodValue, decayedWeight);

      // Asset-level features from batch lookup
      if (log.audioAssetId) {
        const meta = assetMetaById.get(log.audioAssetId);
        if (meta) {
          if (meta.sfxMetadata?.subcategory) {
            this.addW(subcategoryWeights, meta.sfxMetadata.subcategory, decayedWeight * 0.8);
          }
          if (meta.musicalKey) {
            this.addW(musicalKeyWeights, meta.musicalKey, decayedWeight);
          }
          if (meta.bpm) {
            bpmWeightedSum += meta.bpm * decayedWeight;
            bpmTotalWeight += decayedWeight;
          }
          const bucket = getDurationBucket(meta.durationMs);
          this.addW(durationBucketWeights, bucket, decayedWeight);
        }
      }
    }

    // 2. Explicit rating signal (4★ = +4pts, 5★ = +8pts)
    for (const rating of positiveRatings) {
      const rw = (rating.score - 3) * 4;
      totalWeight += rw;
      const { audioAsset: a } = rating;
      this.addW(categoryWeights, a.category.slug, rw);
      for (const t of a.tags) {
        const idf = tagIdf.get(t.tag.slug) ?? 1;
        this.addW(tagWeights, t.tag.slug, rw * 0.8 * idf);
      }
      if (a.mood) this.addW(moodWeights, a.mood, rw * 0.6);
      if (a.sfxMetadata?.subcategory) this.addW(subcategoryWeights, a.sfxMetadata.subcategory, rw * 0.7);
      if (a.musicalKey) this.addW(musicalKeyWeights, a.musicalKey, rw * 0.8);
      if (a.bpm) { bpmWeightedSum += a.bpm * rw; bpmTotalWeight += rw; }
      const bucket = getDurationBucket(a.durationMs);
      this.addW(durationBucketWeights, bucket, rw * 0.5);
    }

    return {
      categoryWeights,
      tagWeights,
      moodWeights,
      subcategoryWeights,
      musicalKeyWeights,
      avgBpm: bpmTotalWeight > 0 ? bpmWeightedSum / bpmTotalWeight : null,
      durationBucketWeights,
      totalWeight,
      reason: strongestReason,
    };
  }

  // ── Vector Algebra ────────────────────────────────────────────────────────────

  private addW(map: Map<string, number>, key: string, value: number) {
    map.set(key, (map.get(key) ?? 0) + value);
  }

  private buildPreferenceVector(userVec: UserVector): Map<string, number> {
    const v = new Map<string, number>();
    for (const [s, w] of userVec.categoryWeights) this.addW(v, `cat:${s}`, w * W_CATEGORY);
    for (const [s, w] of userVec.tagWeights) this.addW(v, `tag:${s}`, w * W_TAG);
    for (const [m, w] of userVec.moodWeights) this.addW(v, `mood:${m}`, w * W_MOOD);
    for (const [s, w] of userVec.subcategoryWeights) this.addW(v, `sub:${s}`, w * W_SUBCATEGORY);
    for (const [k, w] of userVec.musicalKeyWeights) this.addW(v, `key:${k}`, w * 1.2);
    for (const [b, w] of userVec.durationBucketWeights) this.addW(v, `dur:${b}`, w * 0.8);
    return v;
  }

  private buildItemVector(asset: Pick<AssetForScoring, 'category' | 'tags' | 'mood' | 'sfxMetadata' | 'musicalKey' | 'durationMs'>): Map<string, number> {
    const v = new Map<string, number>();
    this.addW(v, `cat:${asset.category.slug}`, W_CATEGORY);
    for (const { tag } of asset.tags) this.addW(v, `tag:${tag.slug}`, W_TAG);
    if (asset.mood) this.addW(v, `mood:${asset.mood}`, W_MOOD);
    if (asset.sfxMetadata?.subcategory) this.addW(v, `sub:${asset.sfxMetadata.subcategory}`, W_SUBCATEGORY);
    if (asset.musicalKey) this.addW(v, `key:${asset.musicalKey}`, 1.2);
    const bucket = getDurationBucket(asset.durationMs);
    this.addW(v, `dur:${bucket}`, 0.8);
    return v;
  }

  /** Standard cosine similarity in [0, 1] */
  cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, normA = 0, normB = 0;
    for (const v of a.values()) normA += v * v;
    for (const v of b.values()) normB += v * v;
    for (const [key, v] of a) dot += v * (b.get(key) ?? 0);
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ── Audio Feature Similarity Bonuses ─────────────────────────────────────────

  /**
   * BPM similarity: 1.0 when BPM matches exactly, 0 when > 200 BPM apart.
   * Smooth triangle function: max(0, 1 - |userBpm - assetBpm| / 200)
   */
  bpmSimilarity(userAvgBpm: number | null, assetBpm: number | null | undefined): number {
    if (!userAvgBpm || !assetBpm) return 0;
    return Math.max(0, 1 - Math.abs(userAvgBpm - assetBpm) / 200);
  }

  /**
   * Musical key compatibility using the Circle of Fifths.
   * Keys adjacent on the circle are harmonically compatible; opposite = dissonant.
   * Returns 1.0 for same key, ~0.5 for relative adjacent, 0.0 for tritone.
   */
  keyCompatibility(userKeyWeights: Map<string, number>, assetKey: string | null | undefined): number {
    if (!assetKey || userKeyWeights.size === 0) return 0;
    const normalizedAssetKey = assetKey.replace('m', '').trim(); // strip minor suffix
    const assetIdx = CIRCLE_OF_FIFTHS.indexOf(normalizedAssetKey);
    if (assetIdx < 0) return 0;

    let weightedScore = 0;
    let totalUserKeyWeight = 0;
    for (const [key, weight] of userKeyWeights) {
      const userIdx = CIRCLE_OF_FIFTHS.indexOf(key.replace('m', '').trim());
      if (userIdx < 0) continue;
      const dist = Math.min(Math.abs(assetIdx - userIdx), 12 - Math.abs(assetIdx - userIdx));
      const similarity = 1 - dist / 6; // normalize [0, 1]
      weightedScore += similarity * weight;
      totalUserKeyWeight += weight;
    }
    return totalUserKeyWeight > 0 ? weightedScore / totalUserKeyWeight : 0;
  }

  /**
   * Duration bucket compatibility: 1.0 if same bucket, 0.0 if very different.
   */
  durationCompatibility(durationBucketWeights: Map<string, number>, assetDurationMs: number): number {
    if (durationBucketWeights.size === 0) return 0;
    const assetBucket = getDurationBucket(assetDurationMs);
    const totalW = [...durationBucketWeights.values()].reduce((a, b) => a + b, 0);
    if (totalW === 0) return 0;
    return (durationBucketWeights.get(assetBucket) ?? 0) / totalW;
  }

  // ── Item Cold-Start Boost ─────────────────────────────────────────────────────

  /**
   * Gives new items (< 7 days) a temporary score boost proportional to their
   * metadata richness.  Encourages discovery of well-described new uploads.
   *
   * boost = metadataRichness × (1 − ageRatio) × NEW_ITEM_MAX_BOOST
   */
  newItemBoost(asset: AssetForScoring): number {
    const ref = asset.publishedAt ?? asset.createdAt;
    const ageMs = Date.now() - ref.getTime();
    const maxAgeMs = NEW_ITEM_AGE_DAYS * 86_400_000;
    if (ageMs >= maxAgeMs) return 0;

    const ageRatio = ageMs / maxAgeMs;
    const richness = [
      asset.mood ? 1 : 0,
      asset.bpm ? 1 : 0,
      asset.sfxMetadata?.subcategory ? 1 : 0,
      asset.tags.length >= 3 ? 1 : 0,
      asset.tags.length >= 5 ? 0.5 : 0,
    ].reduce((a: number, b: number) => a + b, 0) / 4.5;

    return richness * (1 - ageRatio) * NEW_ITEM_MAX_BOOST;
  }

  // ── Composite Scoring ─────────────────────────────────────────────────────────

  computeCBFScore(userVec: UserVector, asset: AssetForScoring): number {
    if (userVec.totalWeight === 0) return 0;
    const prefVec = this.buildPreferenceVector(userVec);
    const itemVec = this.buildItemVector(asset);
    const cosine = this.cosineSimilarity(prefVec, itemVec);
    const bpmBonus = this.bpmSimilarity(userVec.avgBpm, asset.bpm) * W_BPM;
    const keyBonus = this.keyCompatibility(userVec.musicalKeyWeights, asset.musicalKey) * W_KEY;
    const durBonus = this.durationCompatibility(userVec.durationBucketWeights, asset.durationMs) * W_DURATION;
    const popBonus = Math.min((asset.downloadCount + asset.playCount) / 10_000, 1) * W_POPULARITY;
    const coldStartBonus = this.newItemBoost(asset);
    return Math.min(cosine + bpmBonus + keyBonus + durBonus + popBonus + coldStartBonus, 1);
  }

  // ── Per-Item Reason ───────────────────────────────────────────────────────────

  computePerItemReason(userVec: UserVector, asset: AssetForScoring): string {
    let best = 0;
    let reason = '';

    const catW = userVec.categoryWeights.get(asset.category.slug) ?? 0;
    if (catW > best) { best = catW; reason = `Based on your interest in ${this.humanize(asset.category.slug)}`; }

    const sub = asset.sfxMetadata?.subcategory;
    if (sub) {
      const subW = userVec.subcategoryWeights.get(sub) ?? 0;
      if (subW > best) { best = subW; reason = `Matches your preference for ${this.humanize(sub)} sounds`; }
    }

    for (const { tag } of asset.tags) {
      const tagW = userVec.tagWeights.get(tag.slug) ?? 0;
      if (tagW > best) { best = tagW; reason = `Because you like #${this.humanize(tag.slug)} sounds`; }
    }

    if (asset.mood) {
      const moodW = userVec.moodWeights.get(asset.mood) ?? 0;
      if (moodW > best) { reason = `Matches your ${asset.mood} mood preference`; }
    }

    if (!reason && asset.bpm && userVec.avgBpm) {
      const diff = Math.abs(userVec.avgBpm - asset.bpm);
      if (diff < 20) reason = `Matches your preferred tempo (~${Math.round(userVec.avgBpm)} BPM)`;
    }

    return reason || userVec.reason || 'Recommended for you';
  }

  // ── MMR (Maximal Marginal Relevance) ─────────────────────────────────────────

  /**
   * Greedy MMR selection to balance relevance and diversity.
   *
   * At each step, selects the item maximizing:
   *   MMR_i = λ × Sim(i, user) − (1 − λ) × max_{j ∈ selected} Sim(i, j)
   *
   * λ = MMR_LAMBDA (default 0.7 favours relevance slightly over diversity).
   */
  private applyMMR(candidates: ScoredAsset[], k: number): ScoredAsset[] {
    const selected: ScoredAsset[] = [];
    const pool = [...candidates];

    while (selected.length < k && pool.length > 0) {
      let bestIdx = 0;
      let bestMMR = -Infinity;

      for (let i = 0; i < pool.length; i++) {
        const relevance = pool[i].score;
        let maxSim = 0;
        for (const s of selected) {
          const sim = this.cosineSimilarity(this.buildItemVector(pool[i]), this.buildItemVector(s));
          if (sim > maxSim) maxSim = sim;
        }
        const mmr = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;
        if (mmr > bestMMR) { bestMMR = mmr; bestIdx = i; }
      }

      selected.push(pool[bestIdx]);
      pool.splice(bestIdx, 1);
    }

    return selected;
  }

  // ── Session-Based Recommendation ─────────────────────────────────────────────

  /**
   * Builds a vector from only the current session's logs, then blends it with
   * the user's historical vector.
   *
   * blendedVec = SESSION_BLEND_RATIO × sessionVec + (1 − ratio) × historicalVec
   *
   * Captures real-time intent ("right now this user is looking for X") while
   * still respecting long-term preferences.
   */
  async getSessionBased(
    userId: string,
    sessionId: string,
    limit = 10,
  ): Promise<RecommendedSound[]> {
    const [sessionLogs, tagIdf] = await Promise.all([
      this.prisma.userBehaviorLog.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.getTagIdf(),
    ]);

    if (sessionLogs.length === 0) return this.getTrending(limit);

    // Build a lightweight vector from session logs only (no time-decay needed)
    const sessionCategoryW = new Map<string, number>();
    const sessionTagW = new Map<string, number>();
    const sessionMoodW = new Map<string, number>();

    for (const log of sessionLogs) {
      const w = log.weight;
      if (log.categorySlug) this.addW(sessionCategoryW, log.categorySlug, w);
      for (const tag of log.tagSlugs) {
        const idf = tagIdf.get(tag) ?? 1;
        this.addW(sessionTagW, tag, w * idf);
      }
      if (log.moodValue) this.addW(sessionMoodW, log.moodValue, w);
    }

    const histVec = await this.buildUserVector(userId);

    // Blend session signal into historical vector
    const blend = (hist: Map<string, number>, sess: Map<string, number>): Map<string, number> => {
      const result = new Map<string, number>();
      for (const [k, v] of hist) result.set(k, v * (1 - SESSION_BLEND_RATIO));
      for (const [k, v] of sess) result.set(k, (result.get(k) ?? 0) + v * SESSION_BLEND_RATIO);
      return result;
    };

    const blendedVec: UserVector = {
      ...histVec,
      categoryWeights: blend(histVec.categoryWeights, sessionCategoryW),
      tagWeights: blend(histVec.tagWeights, sessionTagW),
      moodWeights: blend(histVec.moodWeights, sessionMoodW),
    };

    const sounds = await this.prisma.audioAsset.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: { slug: { in: [...sessionCategoryW.keys()] } } },
          { tags: { some: { tag: { slug: { in: [...sessionTagW.keys()].slice(0, 10) } } } } },
        ],
      },
      select: ASSET_SELECT,
    });

    let pool = sounds;
    if (pool.length < limit) {
      pool = await this.prisma.audioAsset.findMany({ where: { isPublished: true }, select: ASSET_SELECT });
    }

    return pool
      .map(s => ({ ...s, score: this.computeCBFScore(blendedVec, s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => this.toRecommendedSound(s, blendedVec));
  }

  // ── Main Recommendation Endpoints ─────────────────────────────────────────────

  async getPersonalized(
    userId: string,
    limit = 10,
  ): Promise<PersonalizedResult> {
    const userVec = await this.buildUserVector(userId);

    if (userVec.totalWeight < COLD_START_LIMIT) {
      const trending = await this.getTrending(limit);
      return { items: trending, isColdStart: true, tasteProfile: null };
    }

    // Pre-filter: targeted candidate pool from top categories/tags
    const topCategories = [...userVec.categoryWeights.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, TOP_CATEGORY_FILTER).map(([s]) => s);
    const topTags = [...userVec.tagWeights.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, TOP_TAG_FILTER).map(([s]) => s);

    // Exclude downloaded + wishlisted sounds
    const [ownedAssets, wishlistedAssets] = await Promise.all([
      this.prisma.download.findMany({ where: { userId }, select: { audioAssetId: true } }),
      this.prisma.wishlist.findMany({ where: { userId }, select: { audioAssetId: true } }),
    ]);
    const excludedIds = new Set([
      ...ownedAssets.map(d => d.audioAssetId),
      ...wishlistedAssets.map(w => w.audioAssetId),
    ]);

    // Targeted first pass
    let candidates = await this.prisma.audioAsset.findMany({
      where: {
        isPublished: true,
        OR: [
          { category: { slug: { in: topCategories } } },
          { tags: { some: { tag: { slug: { in: topTags } } } } },
        ],
      },
      select: ASSET_SELECT,
    });

    if (candidates.length < Math.max(MIN_CANDIDATE_POOL, limit)) {
      candidates = await this.prisma.audioAsset.findMany({
        where: { isPublished: true },
        select: ASSET_SELECT,
      });
    }

    const filteredCandidates = candidates.filter(s => !excludedIds.has(s.id));
    const candidateIds = filteredCandidates.map(s => s.id);

    // CF scores (item-item)
    const cfScores = await this.cfService.itemItemScores(userId, candidateIds);

    // Bandit scores
    const banditScores = await this.banditService.sampleScores(candidateIds);

    // Hybrid scoring: CBF + CF + Bandit
    const scored: ScoredAsset[] = filteredCandidates.map(sound => {
      const cbfScore = this.computeCBFScore(userVec, sound);
      const cfScore = cfScores.get(sound.id) ?? 0;
      const banditSample = banditScores.get(sound.id) ?? 0.5;
      const contentScore = CBF_WEIGHT * cbfScore + CF_WEIGHT * cfScore;
      const finalScore = (1 - BANDIT_WEIGHT) * contentScore + BANDIT_WEIGHT * banditSample;
      return { ...sound, score: finalScore };
    });

    // MMR: select diverse top-K
    const preMMR = scored.sort((a, b) => b.score - a.score).slice(0, limit * 3);
    const selected = this.applyMMR(preMMR, limit);

    // Record bandit impressions (non-blocking)
    this.banditService.recordImpressions(selected.map(s => s.id)).catch(() => {});

    const items = selected.map(s => this.toRecommendedSound(s, userVec));

    return { items, isColdStart: false, tasteProfile: this.toTasteProfile(userVec) };
  }

  async getSimilar(audioId: string, limit = 3): Promise<RecommendedSound[]> {
    const source = await this.prisma.audioAsset.findUnique({
      where: { id: audioId },
      select: {
        id: true, title: true,
        category: { select: { slug: true } },
        tags: { select: { tag: { select: { slug: true } } } },
        mood: true, bpm: true, musicalKey: true, durationMs: true,
        sfxMetadata: { select: { subcategory: true } },
      },
    });
    if (!source) return [];

    const subcategoryWeights: Map<string, number> = source.sfxMetadata?.subcategory
      ? new Map([[source.sfxMetadata.subcategory, 8]])
      : new Map();

    const musicalKeyWeights: Map<string, number> = source.musicalKey
      ? new Map([[source.musicalKey, 8]])
      : new Map();

    const pseudoVec: UserVector = {
      categoryWeights: new Map([[source.category.slug, 10]]),
      tagWeights: new Map(source.tags.map(({ tag }) => [tag.slug, 8])),
      moodWeights: source.mood ? new Map([[source.mood, 6]]) : new Map(),
      subcategoryWeights,
      musicalKeyWeights,
      avgBpm: source.bpm ?? null,
      durationBucketWeights: new Map([[getDurationBucket(source.durationMs), 5]]),
      totalWeight: 10 + source.tags.length * 8 + (source.mood ? 6 : 0),
      reason: `Similar to "${source.title}"`,
    };

    // Pre-filter by same category; widen if too few
    let candidates = await this.prisma.audioAsset.findMany({
      where: { isPublished: true, id: { not: audioId }, category: { slug: source.category.slug } },
      select: ASSET_SELECT,
    });
    if (candidates.length < Math.max(MIN_CANDIDATE_POOL, limit)) {
      candidates = await this.prisma.audioAsset.findMany({
        where: { isPublished: true, id: { not: audioId } },
        select: ASSET_SELECT,
      });
    }

    return candidates
      .map(s => ({ ...s, score: this.computeCBFScore(pseudoVec, s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => this.toRecommendedSound(s, pseudoVec));
  }

  async getTrending(limit = 10): Promise<RecommendedSound[]> {
    const sounds = await this.prisma.audioAsset.findMany({
      where: { isPublished: true },
      select: ASSET_SELECT,
    });
    const now = Date.now();
    return sounds
      .map(s => {
        const ageHours = (now - (s.publishedAt ?? s.createdAt).getTime()) / 3_600_000;
        const engagement = s.downloadCount * 2 + s.playCount;
        return { ...s, score: engagement / Math.pow(ageHours + 2, TRENDING_GRAVITY) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({
        ...this.toRecommendedSound(s, null),
        similarityScore: 0,
        reason: 'Trending now',
      }));
  }

  // ── Offline Evaluation ────────────────────────────────────────────────────────

  /**
   * Offline evaluation using temporal train/test split.
   *
   * Methodology:
   *  1. Sort user's downloads by date.
   *  2. Use first 80% as "training" (to build the model state).
   *  3. Use last 20% as "test" ground truth.
   *  4. Get current personalized recommendations.
   *  5. Compute IR metrics against the test set.
   *
   * Note: This is a proxy evaluation — the model already saw the full history.
   * For strict offline evaluation, use the evaluation endpoint with held-out users.
   */
  async evaluateForUser(
    userId: string,
    k = 10,
  ): Promise<(BatchEvaluationResult & { intralistDiversity: number }) | { error: string }> {
    const downloads = await this.prisma.download.findMany({
      where: { userId },
      orderBy: { downloadedAt: 'asc' },
      select: { audioAssetId: true },
    });

    if (downloads.length < 5) {
      return { error: 'Insufficient history: need ≥ 5 downloads for evaluation.' };
    }

    const splitIdx = Math.floor(downloads.length * 0.8);
    const testSet = new Set(downloads.slice(splitIdx).map(d => d.audioAssetId));

    const recs = await this.getPersonalized(userId, k);
    const recommendedIds = recs.items.map(s => s.id);

    const result = this.evaluationService.batchEvaluate(
      [{ relevant: testSet, recommended: recommendedIds }],
      k,
      [recs.items.map(s => ({ categories: [s.category.slug], tags: s.tags.map(t => t.slug) }))],
    );

    return result;
  }

  // ── Taste Profile ─────────────────────────────────────────────────────────────

  async getTasteProfile(userId: string): Promise<TasteProfile> {
    const userVec = await this.buildUserVector(userId);
    return this.toTasteProfile(userVec);
  }

  private toTasteProfile(userVec: UserVector): TasteProfile {
    return {
      topCategories: this.topEntries(userVec.categoryWeights, 5),
      topTags: this.topEntries(userVec.tagWeights, 8),
      topMoods: [...userVec.moodWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([mood, score]) => ({ mood, score })),
      topSubcategories: this.topEntries(userVec.subcategoryWeights, 5),
      avgBpm: userVec.avgBpm ? Math.round(userVec.avgBpm) : null,
      topKeys: [...userVec.musicalKeyWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([key, score]) => ({ key, score })),
      totalInteractions: userVec.totalWeight,
    };
  }

  private topEntries(map: Map<string, number>, n: number) {
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([slug, score]) => ({ slug, name: this.humanize(slug), score }));
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  private toRecommendedSound(
    sound: ScoredAsset & { score: number },
    userVec: UserVector | null,
  ): RecommendedSound {
    return {
      id: sound.id,
      title: sound.title,
      slug: sound.slug,
      previewUrl: sound.previewUrl,
      waveformData: sound.waveformData as number[],
      durationMs: sound.durationMs,
      price: sound.price,
      accessLevel: sound.accessLevel,
      format: sound.format,
      playCount: sound.playCount,
      downloadCount: sound.downloadCount,
      mood: sound.mood,
      bpm: sound.bpm,
      category: sound.category,
      tags: sound.tags.map(({ tag }) => tag),
      similarityScore: Math.round(sound.score * 100),
      reason: userVec ? this.computePerItemReason(userVec, sound) : 'Trending now',
    };
  }

  // ── String Helpers ────────────────────────────────────────────────────────────

  private humanize(value: string): string {
    return value.replace(/[-_]+/g, ' ').trim();
  }

  private tokenize(value: string): string[] {
    return value.toLowerCase().split(/[^a-z0-9]+/i).map(t => t.trim()).filter(t => t.length > 1);
  }

  private isMoodTerm(term: string): boolean {
    return ['upbeat', 'calm', 'epic', 'sad', 'dark', 'happy', 'neutral', 'tense'].includes(term);
  }

  private actionLabel(action: string): string {
    return ({
      search: 'searched for', click: 'opened', play: 'previewed',
      play_long: 'listened longer to', wishlist: 'saved', cart: 'added to cart',
      download: 'downloaded', purchase: 'purchased',
    } as Record<string, string>)[action] ?? 'interacted with';
  }
}
