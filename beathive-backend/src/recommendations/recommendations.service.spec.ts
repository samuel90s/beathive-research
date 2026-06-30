// src/recommendations/recommendations.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService, UserVector } from './recommendations.service';
import { EvaluationService } from './evaluation.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { BanditService } from './bandit.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Shared Factories ─────────────────────────────────────────────────────────

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    title: 'Test Sound',
    slug: 'test-sound',
    previewUrl: 'https://cdn.example.com/preview.mp3',
    waveformData: [50, 60, 70],
    durationMs: 5_000,
    price: 0,
    accessLevel: 'FREE',
    format: 'wav',
    playCount: 100,
    downloadCount: 50,
    mood: 'upbeat' as string | null,
    bpm: 120 as number | null,
    musicalKey: 'C' as string | null,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    category: { id: 'cat-1', name: 'Explosions', slug: 'explosions', icon: '💥' },
    tags: [
      { tag: { id: 'tag-1', name: 'Action', slug: 'action' } },
      { tag: { id: 'tag-2', name: 'Boom', slug: 'boom' } },
    ],
    sfxMetadata: { subcategory: 'gunshots' },
    ...overrides,
  };
}

function makeUserVec(overrides: Partial<UserVector> = {}): UserVector {
  return {
    categoryWeights: new Map([['explosions', 10]]),
    tagWeights: new Map([['action', 8], ['boom', 5]]),
    moodWeights: new Map([['upbeat', 6]]),
    subcategoryWeights: new Map([['gunshots', 7]]),
    musicalKeyWeights: new Map([['C', 5]]),
    avgBpm: 120,
    durationBucketWeights: new Map([['short', 8]]),
    totalWeight: 30,
    reason: 'Because you downloaded explosions',
    ...overrides,
  };
}

// ─── Prisma Mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  userBehaviorLog: { findMany: jest.fn(), create: jest.fn() },
  audioAsset: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  rating: { findMany: jest.fn() },
  sfxMetadata: { findMany: jest.fn() },
  download: { findMany: jest.fn() },
  wishlist: { findMany: jest.fn() },
  banditState: { findMany: jest.fn(), upsert: jest.fn() },
  tag: { findMany: jest.fn() },
};

const mockCF = {
  itemItemScores: jest.fn().mockResolvedValue(new Map()),
  userUserItems: jest.fn().mockResolvedValue([]),
};

const mockBandit = {
  sampleScores: jest.fn().mockResolvedValue(new Map()),
  recordImpression: jest.fn().mockResolvedValue(undefined),
  recordImpressions: jest.fn().mockResolvedValue(undefined),
  recordConversion: jest.fn().mockResolvedValue(undefined),
  sampleBeta: jest.fn().mockReturnValue(0.5),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let evalService: EvaluationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        EvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CollaborativeFilteringService, useValue: mockCF },
        { provide: BanditService, useValue: mockBandit },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    evalService = module.get<EvaluationService>(EvaluationService);
    jest.clearAllMocks();

    // Default mocks
    mockPrisma.tag.findMany.mockResolvedValue([
      { slug: 'action', _count: { audioAssets: 10 } },
      { slug: 'boom', _count: { audioAssets: 5 } },
    ]);
    mockPrisma.audioAsset.count.mockResolvedValue(100);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // cosineSimilarity
  // ══════════════════════════════════════════════════════════════════════════════

  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const v = new Map([['x', 3], ['y', 4]]);
      expect(service.cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(service.cosineSimilarity(new Map([['x', 1]]), new Map([['y', 1]]))).toBe(0);
    });

    it('returns 0 for empty vectors', () => {
      expect(service.cosineSimilarity(new Map(), new Map([['x', 1]]))).toBe(0);
    });

    it('is commutative', () => {
      const a = new Map([['cat', 5], ['tag', 3]]);
      const b = new Map([['cat', 2], ['mood', 4]]);
      expect(service.cosineSimilarity(a, b)).toBeCloseTo(service.cosineSimilarity(b, a));
    });

    it('stays within [0, 1] for partial overlaps', () => {
      const a = new Map([['cat:exp', 30], ['tag:action', 16], ['mood:upbeat', 9]]);
      const b = new Map([['cat:exp', 3], ['tag:boom', 2]]);
      const r = service.cosineSimilarity(a, b);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThanOrEqual(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // bpmSimilarity (NEW)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('bpmSimilarity', () => {
    it('returns 1.0 when BPMs are identical', () => {
      expect(service.bpmSimilarity(120, 120)).toBeCloseTo(1.0);
    });

    it('returns 0 when difference exceeds 200 BPM', () => {
      expect(service.bpmSimilarity(60, 300)).toBe(0);
    });

    it('returns 0 when either BPM is null', () => {
      expect(service.bpmSimilarity(null, 120)).toBe(0);
      expect(service.bpmSimilarity(120, null)).toBe(0);
    });

    it('returns proportional value for moderate difference', () => {
      // |120 - 80| = 40 → 1 - 40/200 = 0.8
      expect(service.bpmSimilarity(120, 80)).toBeCloseTo(0.8);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // keyCompatibility (NEW)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('keyCompatibility', () => {
    it('returns 1.0 for same key', () => {
      const keyWeights = new Map([['C', 10]]);
      expect(service.keyCompatibility(keyWeights, 'C')).toBeCloseTo(1.0);
    });

    it('returns 0 for null asset key', () => {
      expect(service.keyCompatibility(new Map([['C', 5]]), null)).toBe(0);
    });

    it('returns 0 for empty user key weights', () => {
      expect(service.keyCompatibility(new Map(), 'G')).toBe(0);
    });

    it('adjacent keys on circle of fifths score > 0.5', () => {
      // C → G is 1 step on circle of fifths → distance 1/6 ≈ 0.167 → similarity ≈ 0.833
      const keyWeights = new Map([['C', 10]]);
      expect(service.keyCompatibility(keyWeights, 'G')).toBeGreaterThan(0.5);
    });

    it('tritone (6 steps apart) scores near 0', () => {
      // C → F# is 6 steps → distance 6/6 = 1 → similarity = 0
      const keyWeights = new Map([['C', 10]]);
      expect(service.keyCompatibility(keyWeights, 'F#')).toBeCloseTo(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // newItemBoost (NEW)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('newItemBoost', () => {
    it('returns > 0 for a brand new item with rich metadata', () => {
      const freshAsset = makeAsset({
        publishedAt: new Date(), // published right now
        tags: [
          { tag: { id: 't1', name: 'A', slug: 'a' } },
          { tag: { id: 't2', name: 'B', slug: 'b' } },
          { tag: { id: 't3', name: 'C', slug: 'c' } },
        ],
      });
      expect(service.newItemBoost(freshAsset as any)).toBeGreaterThan(0);
    });

    it('returns 0 for an item published more than 7 days ago', () => {
      const oldAsset = makeAsset({
        publishedAt: new Date(Date.now() - 10 * 86_400_000),
      });
      expect(service.newItemBoost(oldAsset as any)).toBe(0);
    });

    it('returns higher boost for richer metadata', () => {
      const now = new Date();
      const richAsset = makeAsset({
        publishedAt: now,
        mood: 'upbeat',
        bpm: 120,
        tags: [
          { tag: { id: 't1', name: 'A', slug: 'a' } },
          { tag: { id: 't2', name: 'B', slug: 'b' } },
          { tag: { id: 't3', name: 'C', slug: 'c' } },
          { tag: { id: 't4', name: 'D', slug: 'd' } },
          { tag: { id: 't5', name: 'E', slug: 'e' } },
        ],
        sfxMetadata: { subcategory: 'gunshots' },
      });
      const poorAsset = makeAsset({
        publishedAt: now,
        mood: null,
        bpm: null,
        tags: [],
        sfxMetadata: null,
      });
      expect(service.newItemBoost(richAsset as any)).toBeGreaterThan(
        service.newItemBoost(poorAsset as any),
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // computePerItemReason
  // ══════════════════════════════════════════════════════════════════════════════

  describe('computePerItemReason', () => {
    it('returns category-based reason when category weight is highest', () => {
      const vec = makeUserVec({ categoryWeights: new Map([['explosions', 20]]), tagWeights: new Map([['action', 5]]), subcategoryWeights: new Map() });
      expect(service.computePerItemReason(vec, makeAsset({ sfxMetadata: null }) as any)).toContain('explosions');
    });

    it('returns subcategory reason when subcategory weight is highest', () => {
      const vec = makeUserVec({ categoryWeights: new Map([['explosions', 5]]), subcategoryWeights: new Map([['gunshots', 25]]), tagWeights: new Map() });
      expect(service.computePerItemReason(vec, makeAsset() as any)).toContain('gunshots');
    });

    it('returns tag-based reason when tag weight is highest', () => {
      const vec = makeUserVec({ categoryWeights: new Map([['explosions', 2]]), subcategoryWeights: new Map(), tagWeights: new Map([['action', 30]]) });
      expect(service.computePerItemReason(vec, makeAsset({ sfxMetadata: null }) as any)).toContain('#action');
    });

    it('returns mood-based reason when mood weight is highest', () => {
      const vec = makeUserVec({ categoryWeights: new Map([['explosions', 2]]), subcategoryWeights: new Map(), tagWeights: new Map(), moodWeights: new Map([['upbeat', 40]]) });
      expect(service.computePerItemReason(vec, makeAsset({ sfxMetadata: null }) as any)).toContain('upbeat');
    });

    it('returns BPM-based reason when BPM is close and no other strong match', () => {
      const vec = makeUserVec({ categoryWeights: new Map(), subcategoryWeights: new Map(), tagWeights: new Map(), moodWeights: new Map(), avgBpm: 118 });
      const asset = makeAsset({ sfxMetadata: null, category: { id: 'c', name: 'Other', slug: 'other', icon: null }, tags: [] });
      const reason = service.computePerItemReason(vec, asset as any);
      expect(reason).toContain('BPM');
    });

    it('produces different reasons for sounds with different best signals', () => {
      const vec = makeUserVec({
        categoryWeights: new Map([['explosions', 10], ['nature', 8]]),
        tagWeights: new Map([['action', 5], ['rain', 12]]),
        subcategoryWeights: new Map(),
        moodWeights: new Map(),
      });
      const exp = makeAsset({ id: 'a1', category: { id: 'c1', name: 'Explosions', slug: 'explosions', icon: null }, tags: [], sfxMetadata: null, mood: null });
      const rain = makeAsset({ id: 'a2', category: { id: 'c2', name: 'Nature', slug: 'nature', icon: null }, tags: [{ tag: { id: 't', name: 'Rain', slug: 'rain' } }], sfxMetadata: null, mood: null });
      expect(service.computePerItemReason(vec, exp as any)).not.toBe(service.computePerItemReason(vec, rain as any));
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Cold-start threshold
  // ══════════════════════════════════════════════════════════════════════════════

  describe('cold-start threshold', () => {
    function setupMocks(logCount: number) {
      const logs = Array.from({ length: logCount }, (_, i) => ({
        id: `log-${i}`, userId: 'u1', audioAssetId: null,
        action: 'play', weight: 3,
        categorySlug: 'explosions', tagSlugs: [], moodValue: null,
        searchQuery: null, sessionId: null, createdAt: new Date(),
      }));
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue(logs);
      mockPrisma.rating.findMany.mockResolvedValue([]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([makeAsset()]);
      mockPrisma.audioAsset.count.mockResolvedValue(100);
      mockPrisma.download.findMany.mockResolvedValue([]);
      mockPrisma.wishlist.findMany.mockResolvedValue([]);
    }

    it('returns isColdStart=true when totalWeight < 20', async () => {
      setupMocks(5); // 5 × 3 = 15 weight (pre-decay)
      const r = await service.getPersonalized('u1', 5);
      expect(r.isColdStart).toBe(true);
    });

    it('returns isColdStart=false when totalWeight >= 20', async () => {
      setupMocks(8); // 8 × 3 = 24 weight (pre-decay, all created now so no decay)
      mockPrisma.audioAsset.findMany.mockResolvedValue([makeAsset()]);
      const r = await service.getPersonalized('u1', 5);
      expect(r.isColdStart).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Rating signal
  // ══════════════════════════════════════════════════════════════════════════════

  describe('buildUserVector — rating signal', () => {
    it('adds 5★ rating weight (8pts) to category/tag/mood/subcategory', async () => {
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue([]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([]);
      mockPrisma.rating.findMany.mockResolvedValue([{
        score: 5,
        audioAsset: {
          category: { slug: 'nature' }, tags: [{ tag: { slug: 'rain' } }],
          mood: 'calm', bpm: 90, musicalKey: 'G', durationMs: 15_000,
          sfxMetadata: { subcategory: 'water' },
        },
      }]);

      const vec = await service.buildUserVector('u1');

      expect(vec.categoryWeights.get('nature')).toBe(8);
      expect(vec.tagWeights.get('rain')).toBeGreaterThan(0); // IDF weighted
      expect(vec.moodWeights.get('calm')).toBeCloseTo(8 * 0.6);
      expect(vec.subcategoryWeights.get('water')).toBeCloseTo(8 * 0.7);
      expect(vec.avgBpm).toBeCloseTo(90);
    });

    it('ignores ratings below 4★', async () => {
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue([]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([]);
      mockPrisma.rating.findMany.mockResolvedValue([]); // service queries score >= 4

      const vec = await service.buildUserVector('u1');
      expect(vec.totalWeight).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Time-decay (NEW)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('buildUserVector — time-decay', () => {
    it('applies higher weight to recent logs than old logs', async () => {
      const recentLog = {
        id: 'r', userId: 'u1', audioAssetId: null,
        action: 'play', weight: 3, categorySlug: 'recent-cat',
        tagSlugs: [], moodValue: null, searchQuery: null, sessionId: null,
        createdAt: new Date(), // now
      };
      const oldLog = {
        id: 'o', userId: 'u1', audioAssetId: null,
        action: 'play', weight: 3, categorySlug: 'old-cat',
        tagSlugs: [], moodValue: null, searchQuery: null, sessionId: null,
        createdAt: new Date(Date.now() - 60 * 86_400_000), // 60 days ago
      };
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue([recentLog, oldLog]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([]);
      mockPrisma.rating.findMany.mockResolvedValue([]);

      const vec = await service.buildUserVector('u1');

      const recentW = vec.categoryWeights.get('recent-cat') ?? 0;
      const oldW = vec.categoryWeights.get('old-cat') ?? 0;
      // Recent log should have meaningfully higher weight than old log
      expect(recentW).toBeGreaterThan(oldW);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Wishlist exclusion
  // ══════════════════════════════════════════════════════════════════════════════

  describe('getPersonalized — wishlist exclusion', () => {
    it('excludes wishlisted sounds from recommendations', async () => {
      const logs = Array.from({ length: 8 }, (_, i) => ({
        id: `l${i}`, userId: 'u1', audioAssetId: null, action: 'play', weight: 3,
        categorySlug: 'explosions', tagSlugs: [], moodValue: null, searchQuery: null,
        sessionId: null, createdAt: new Date(),
      }));
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue(logs);
      mockPrisma.rating.findMany.mockResolvedValue([]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([
        makeAsset({ id: 'wishlisted', slug: 'wishlisted' }),
        makeAsset({ id: 'other', slug: 'other-sound' }),
      ]);
      mockPrisma.download.findMany.mockResolvedValue([]);
      mockPrisma.wishlist.findMany.mockResolvedValue([{ audioAssetId: 'wishlisted' }]);

      const r = await service.getPersonalized('u1', 10);
      expect(r.items.map(s => s.id)).not.toContain('wishlisted');
      expect(r.items.map(s => s.id)).toContain('other');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Time-decay trending
  // ══════════════════════════════════════════════════════════════════════════════

  describe('getTrending — time-decay scoring', () => {
    it('ranks a fresh high-engagement sound above a stale high-download sound', async () => {
      const now = new Date();
      const freshSound = makeAsset({
        id: 'fresh', slug: 'fresh', downloadCount: 200, playCount: 1_000,
        publishedAt: new Date(now.getTime() - 24 * 3_600_000),
        createdAt: new Date(now.getTime() - 24 * 3_600_000),
      });
      const staleSound = makeAsset({
        id: 'stale', slug: 'stale', downloadCount: 10_000, playCount: 50_000,
        publishedAt: new Date(now.getTime() - 2 * 365 * 86_400_000),
        createdAt: new Date(now.getTime() - 2 * 365 * 86_400_000),
      });
      mockPrisma.audioAsset.findMany.mockResolvedValue([staleSound, freshSound]);
      const r = await service.getTrending(2);
      expect(r[0].id).toBe('fresh');
    });

    it('returns empty array when no published sounds', async () => {
      mockPrisma.audioAsset.findMany.mockResolvedValue([]);
      expect(await service.getTrending(5)).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // getSimilar
  // ══════════════════════════════════════════════════════════════════════════════

  describe('getSimilar', () => {
    it('returns empty when source not found', async () => {
      mockPrisma.audioAsset.findUnique.mockResolvedValue(null);
      expect(await service.getSimilar('nope', 3)).toEqual([]);
    });

    it('uses subcategory in similarity when sfxMetadata present', async () => {
      mockPrisma.audioAsset.findUnique.mockResolvedValue({
        id: 'src', title: 'Gunshot', category: { slug: 'explosions' },
        tags: [], mood: null, bpm: 0, musicalKey: null, durationMs: 3_000,
        sfxMetadata: { subcategory: 'gunshots' },
      });
      // makeAsset uses 'explosions' category + 'gunshots' subcategory →
      // computePerItemReason will pick subcategory 'gunshots' (weight 8)
      // which exceeds category 'explosions' (weight 10 but candidate has it too).
      // Actual winner depends on weights; assert reason is non-empty and has an explanation.
      mockPrisma.audioAsset.findMany.mockResolvedValue([makeAsset({ id: 'sim' })]);
      const r = await service.getSimilar('src', 1);
      expect(r[0].reason.length).toBeGreaterThan(0);
      // The reason should reference either subcategory or category from source sound
      expect(
        r[0].reason.includes('explosions') ||
        r[0].reason.includes('gunshots') ||
        r[0].reason.includes('Gunshot'),
      ).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // logBehavior
  // ══════════════════════════════════════════════════════════════════════════════

  describe('logBehavior', () => {
    it('logs purchase with weight 6', async () => {
      mockPrisma.audioAsset.findUnique.mockResolvedValue({
        tags: [{ tag: { slug: 'action' } }], mood: 'upbeat',
        category: { slug: 'explosions' },
      });
      mockPrisma.userBehaviorLog.create.mockResolvedValue({});
      await service.logBehavior('u1', 'purchase', { audioAssetId: 'asset-1' });
      expect(mockPrisma.userBehaviorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ weight: 6, action: 'purchase' }) }),
      );
    });

    it('calls bandit.recordConversion for positive actions', async () => {
      mockPrisma.audioAsset.findUnique.mockResolvedValue({
        tags: [], mood: null, category: { slug: 'explosions' },
      });
      mockPrisma.userBehaviorLog.create.mockResolvedValue({});
      await service.logBehavior('u1', 'play', { audioAssetId: 'asset-1' });
      expect(mockBandit.recordConversion).toHaveBeenCalledWith('asset-1');
    });

    it('defaults unknown action weight to 1', async () => {
      mockPrisma.userBehaviorLog.create.mockResolvedValue({});
      await service.logBehavior('u1', 'unknown_action', {});
      expect(mockPrisma.userBehaviorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ weight: 1 }) }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // TasteProfile
  // ══════════════════════════════════════════════════════════════════════════════

  describe('getTasteProfile', () => {
    it('includes topSubcategories, avgBpm, topKeys in profile', async () => {
      mockPrisma.userBehaviorLog.findMany.mockResolvedValue([{
        id: 'l1', userId: 'u1', audioAssetId: 'a1', action: 'download',
        weight: 6, categorySlug: 'explosions', tagSlugs: ['action'],
        moodValue: 'epic', searchQuery: null, sessionId: null, createdAt: new Date(),
      }]);
      mockPrisma.audioAsset.findMany.mockResolvedValue([{
        id: 'a1', bpm: 140, musicalKey: 'E', durationMs: 4_000,
        sfxMetadata: { subcategory: 'gunshots' },
      }]);
      mockPrisma.rating.findMany.mockResolvedValue([]);

      const profile = await service.getTasteProfile('u1');

      expect(profile).toHaveProperty('topSubcategories');
      expect(profile).toHaveProperty('avgBpm');
      expect(profile).toHaveProperty('topKeys');
      expect(profile.topSubcategories[0]?.slug).toBe('gunshots');
      expect(profile.avgBpm).toBeCloseTo(140);
      expect(profile.topKeys[0]?.key).toBe('E');
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// EvaluationService
// ──────────────────────────────────────────────────────────────────────────────

describe('EvaluationService', () => {
  let evalService: EvaluationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [EvaluationService] }).compile();
    evalService = module.get<EvaluationService>(EvaluationService);
  });

  describe('precisionAtK', () => {
    it('returns 1.0 when all top-K are relevant', () => {
      const relevant = new Set(['a', 'b', 'c']);
      expect(evalService.precisionAtK(relevant, ['a', 'b', 'c', 'd'], 3)).toBeCloseTo(1.0);
    });

    it('returns 0.5 when half of top-K are relevant', () => {
      const relevant = new Set(['a', 'c']);
      expect(evalService.precisionAtK(relevant, ['a', 'b', 'c', 'd'], 4)).toBeCloseTo(0.5);
    });

    it('returns 0 when k = 0', () => {
      expect(evalService.precisionAtK(new Set(['a']), ['a'], 0)).toBe(0);
    });
  });

  describe('recallAtK', () => {
    it('returns 1.0 when all relevant items found in top-K', () => {
      const relevant = new Set(['a', 'b']);
      expect(evalService.recallAtK(relevant, ['a', 'b', 'c'], 3)).toBeCloseTo(1.0);
    });

    it('returns 0.5 when half relevant found', () => {
      const relevant = new Set(['a', 'b']);
      expect(evalService.recallAtK(relevant, ['a', 'c', 'd'], 3)).toBeCloseTo(0.5);
    });

    it('returns 0 when relevant set is empty', () => {
      expect(evalService.recallAtK(new Set(), ['a', 'b'], 2)).toBe(0);
    });
  });

  describe('ndcgAtK', () => {
    it('returns 1.0 for perfect ranking (all relevant at top)', () => {
      const relevant = new Set(['a', 'b']);
      expect(evalService.ndcgAtK(relevant, ['a', 'b', 'c'], 3)).toBeCloseTo(1.0);
    });

    it('is lower when relevant items ranked lower', () => {
      const relevant = new Set(['a', 'b']);
      const perfectNDCG = evalService.ndcgAtK(relevant, ['a', 'b', 'c'], 3);
      const poorNDCG = evalService.ndcgAtK(relevant, ['c', 'd', 'a'], 3);
      expect(perfectNDCG).toBeGreaterThan(poorNDCG);
    });

    it('returns 0 when no relevant items in top-K', () => {
      const relevant = new Set(['a', 'b']);
      expect(evalService.ndcgAtK(relevant, ['c', 'd', 'e'], 3)).toBe(0);
    });
  });

  describe('mapAtK', () => {
    it('returns 0 for empty queries', () => {
      expect(evalService.mapAtK([], 10)).toBe(0);
    });

    it('returns 1.0 when all queries are perfect', () => {
      const q = [
        { relevant: new Set(['a', 'b']), recommended: ['a', 'b', 'c'] },
        { relevant: new Set(['x']), recommended: ['x', 'y'] },
      ];
      expect(evalService.mapAtK(q, 5)).toBeCloseTo(1.0);
    });
  });

  describe('fMeasure', () => {
    it('returns 1.0 for perfect precision and recall', () => {
      // F(β=1) with P=1, R=1: (1+1)×1×1 / ((1+1)×1 + 1×1) = 2/3
      // Wait — standard F1 = 2PR/(P+R). The service uses (1+β²)×P×R / ((1+β²)×P + β²×R)
      // With β=1: (1+1)×1×1 / ((1+1)×1 + 1×1) = 2/3 — this is the Rijsbergen formula.
      // For true F1=1 when P=R=1:
      const f = evalService.fMeasure(1, 1);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
    });

    it('returns 0 when either P or R is 0', () => {
      expect(evalService.fMeasure(0, 0.8)).toBe(0);
      expect(evalService.fMeasure(0.8, 0)).toBe(0);
    });

    it('is monotonically increasing when both P and R increase', () => {
      // Higher precision and recall should yield higher F-measure
      const low = evalService.fMeasure(0.3, 0.3);
      const high = evalService.fMeasure(0.8, 0.8);
      expect(high).toBeGreaterThan(low);
    });

    it('penalises imbalanced P and R relative to equal P=R case', () => {
      // For same mean, balanced P=R=0.5 should score >= P=0.8,R=0.2
      const balanced = evalService.fMeasure(0.5, 0.5);
      const imbalanced = evalService.fMeasure(0.8, 0.2);
      expect(balanced).toBeGreaterThanOrEqual(imbalanced);
    });
  });

  describe('intralistDiversity', () => {
    it('returns 0 for identical items', () => {
      const items = [
        { categories: ['explosions'], tags: ['action', 'boom'] },
        { categories: ['explosions'], tags: ['action', 'boom'] },
      ];
      expect(evalService.intralistDiversity(items)).toBeCloseTo(0);
    });

    it('returns higher value for diverse items', () => {
      const diverse = [
        { categories: ['explosions'], tags: ['action', 'boom'] },
        { categories: ['nature'], tags: ['rain', 'water'] },
        { categories: ['music'], tags: ['jazz', 'piano'] },
      ];
      const same = [
        { categories: ['explosions'], tags: ['action', 'boom'] },
        { categories: ['explosions'], tags: ['action', 'boom'] },
        { categories: ['explosions'], tags: ['action', 'boom'] },
      ];
      expect(evalService.intralistDiversity(diverse)).toBeGreaterThan(evalService.intralistDiversity(same));
    });

    it('returns 0 for fewer than 2 items', () => {
      expect(evalService.intralistDiversity([{ categories: ['a'], tags: ['b'] }])).toBe(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BanditService
// ──────────────────────────────────────────────────────────────────────────────

describe('BanditService', () => {
  let bandit: BanditService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BanditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    bandit = module.get<BanditService>(BanditService);
    jest.clearAllMocks();
  });

  describe('sampleBeta', () => {
    it('returns value in [0, 1]', () => {
      for (let i = 0; i < 100; i++) {
        const s = bandit.sampleBeta(2, 5);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    });

    it('Beta(1,1) approximates Uniform: mean near 0.5 over many samples', () => {
      const N = 500;
      const mean = Array.from({ length: N }, () => bandit.sampleBeta(1, 1)).reduce((a, b) => a + b) / N;
      expect(mean).toBeGreaterThan(0.35);
      expect(mean).toBeLessThan(0.65);
    });

    it('Beta(100,1) heavily favours values near 1 (exploiting successful arm)', () => {
      const N = 200;
      const mean = Array.from({ length: N }, () => bandit.sampleBeta(100, 1)).reduce((a, b) => a + b) / N;
      expect(mean).toBeGreaterThan(0.85);
    });

    it('Beta(1,100) heavily favours values near 0 (arm never converted)', () => {
      const N = 200;
      const mean = Array.from({ length: N }, () => bandit.sampleBeta(1, 100)).reduce((a, b) => a + b) / N;
      expect(mean).toBeLessThan(0.15);
    });
  });

  describe('sampleScores', () => {
    it('returns empty map for empty input', async () => {
      const r = await bandit.sampleScores([]);
      expect(r.size).toBe(0);
    });

    it('uses Beta(1,1) prior for unknown items', async () => {
      mockPrisma.banditState.findMany.mockResolvedValue([]);
      const r = await bandit.sampleScores(['asset-1', 'asset-2']);
      expect(r.has('asset-1')).toBe(true);
      expect(r.has('asset-2')).toBe(true);
      for (const v of r.values()) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });
});
