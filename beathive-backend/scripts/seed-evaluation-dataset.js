const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const PREFIX = 'SIM-EVAL-2026';
const USER_COUNT = 20;
const ASSET_COUNT = 120;
const ASSETS_PER_USER = 50;
const HOLDOUT_PER_USER = 10;
const PASSWORD = 'password123';

const ACTION_WEIGHTS = {
  search: 1,
  click: 2,
  play: 3,
  play_long: 4,
  wishlist: 4,
  cart: 5,
  download: 6,
  purchase: 6,
};

const CLUSTERS = [
  {
    slug: 'cinematic-impact',
    category: ['cinematic-sfx', 'Cinematic SFX'],
    mood: 'epic',
    subcategory: 'impact',
    tags: ['impact', 'cinematic', 'trailer', 'hit', 'boom', 'rise'],
    title: 'Cinematic Impact',
  },
  {
    slug: 'horror-ambience',
    category: ['horror-ambience', 'Horror Ambience'],
    mood: 'dark',
    subcategory: 'ambience',
    tags: ['horror', 'ambience', 'dark', 'tension', 'drone', 'night'],
    title: 'Horror Ambience',
  },
  {
    slug: 'vehicle-motion',
    category: ['vehicle-sfx', 'Vehicle SFX'],
    mood: 'tense',
    subcategory: 'vehicle',
    tags: ['vehicle', 'engine', 'brake', 'pass-by', 'road', 'movement'],
    title: 'Vehicle Motion',
  },
  {
    slug: 'sports-crowd',
    category: ['sports-crowd', 'Sports Crowd'],
    mood: 'happy',
    subcategory: 'crowd',
    tags: ['crowd', 'stadium', 'cheer', 'whistle', 'sports', 'game'],
    title: 'Sports Crowd',
  },
  {
    slug: 'nature-water',
    category: ['nature-water', 'Nature Water'],
    mood: 'calm',
    subcategory: 'nature',
    tags: ['water', 'rain', 'river', 'nature', 'calm', 'ambient'],
    title: 'Nature Water',
  },
  {
    slug: 'ui-foley',
    category: ['ui-foley', 'UI Foley'],
    mood: 'neutral',
    subcategory: 'foley',
    tags: ['click', 'tap', 'switch', 'interface', 'ui', 'button'],
    title: 'UI Foley',
  },
];

function daysAgo(days, minutes = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - minutes * 60 * 1000);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pick(arr, index) {
  return arr[index % arr.length];
}

function unique(values) {
  return [...new Set(values)];
}

function scoreCandidate(profile, asset) {
  let score = 0;
  score += profile.categories.get(asset.category.slug) ?? 0;
  score += (profile.moods.get(asset.mood) ?? 0) * 0.8;
  score += (profile.subcategories.get(asset.sfxMetadata?.subcategory) ?? 0) * 0.7;
  for (const tag of asset.tags.map((entry) => entry.tag.slug)) {
    score += (profile.tags.get(tag) ?? 0) * 1.2;
  }
  return score;
}

function metricForUser(relevant, recommended, k) {
  const top = recommended.slice(0, k);
  let hits = 0;
  let dcg = 0;
  let apSum = 0;

  top.forEach((id, index) => {
    if (relevant.has(id)) {
      hits += 1;
      dcg += 1 / Math.log2(index + 2);
      apSum += hits / (index + 1);
    }
  });

  const idealHits = Math.min(relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }

  return {
    precision: hits / k,
    recall: relevant.size === 0 ? 0 : hits / relevant.size,
    ndcg: idcg === 0 ? 0 : dcg / idcg,
    averagePrecision: relevant.size === 0 ? 0 : apSum / Math.min(relevant.size, k),
  };
}

async function ensureBaseData() {
  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    update: {},
    create: {
      name: 'Free',
      slug: 'free',
      priceMonthly: 0,
      priceYearly: 0,
      downloadLimit: 5,
    },
  });

  for (const cluster of CLUSTERS) {
    await prisma.category.upsert({
      where: { slug: cluster.category[0] },
      update: { name: cluster.category[1], type: 'sfx' },
      create: { slug: cluster.category[0], name: cluster.category[1], type: 'sfx' },
    });
    for (const tag of cluster.tags) {
      await prisma.tag.upsert({
        where: { slug: tag },
        update: {},
        create: { slug: tag, name: tag.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ') },
      });
    }
  }

  return { freePlan };
}

async function seedAssets() {
  const assets = [];
  for (let i = 0; i < ASSET_COUNT; i += 1) {
    const cluster = pick(CLUSTERS, i);
    const category = await prisma.category.findUnique({ where: { slug: cluster.category[0] } });
    const title = `${cluster.title} ${String(i + 1).padStart(3, '0')}`;
    const slug = `${PREFIX.toLowerCase()}-${slugify(title)}`;
    const createdAt = daysAgo(ASSET_COUNT - i, i);
    const asset = await prisma.audioAsset.upsert({
      where: { slug },
      update: {
        title,
        categoryId: category.id,
        mood: cluster.mood,
        isPublished: true,
        reviewStatus: 'APPROVED',
        publishedAt: createdAt,
      },
      create: {
        assetType: 'SFX',
        categoryId: category.id,
        title,
        slug,
        description: `${title} simulated evaluation asset for BeatHive recommendation testing.`,
        fileUrl: `/simulation/${PREFIX}/private/${slug}.wav`,
        previewUrl: `/simulation/${PREFIX}/preview/${slug}.mp3`,
        waveformData: Array.from({ length: 48 }, (_, idx) => 20 + ((idx * 7 + i) % 70)),
        durationMs: 2500 + (i % 40) * 900,
        fileSize: 400000 + i * 2048,
        format: 'wav',
        price: 10000 + (i % 6) * 5000,
        accessLevel: i % 4 === 0 ? 'PURCHASE' : 'FREE',
        licenseType: i % 3 === 0 ? 'both' : 'personal',
        isPublished: true,
        publishedAt: createdAt,
        reviewStatus: 'APPROVED',
        reviewedAt: createdAt,
        bpm: 80 + (i % 70),
        mood: cluster.mood,
        musicalKey: pick(['C', 'D', 'Em', 'G', 'Am', 'F'], i),
        playCount: 40 + (i % 120),
        downloadCount: 10 + (i % 80),
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.sfxMetadata.upsert({
      where: { assetId: asset.id },
      update: { subcategory: cluster.subcategory },
      create: { assetId: asset.id, subcategory: cluster.subcategory },
    });

    const tagRows = [];
    for (const tagSlug of cluster.tags) {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      tagRows.push({ audioAssetId: asset.id, tagId: tag.id });
    }
    await prisma.audioAssetOnTag.createMany({ data: tagRows, skipDuplicates: true });
    assets.push({ ...asset, clusterSlug: cluster.slug });
  }
  return assets;
}

async function cleanupUsers() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${PREFIX.toLowerCase()}-user-` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length > 0) {
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.download.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wishlist.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.rating.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userBehaviorLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function seedUsersAndInteractions(freePlan, assets) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = [];
  const byCluster = new Map();
  for (const asset of assets) {
    if (!byCluster.has(asset.clusterSlug)) byCluster.set(asset.clusterSlug, []);
    byCluster.get(asset.clusterSlug).push(asset);
  }

  for (let u = 0; u < USER_COUNT; u += 1) {
    const cluster = pick(CLUSTERS, u);
    const secondary = pick(CLUSTERS, u + 2);
    const preferredAssets = [
      ...byCluster.get(cluster.slug),
      ...byCluster.get(secondary.slug).slice(0, 20),
    ].slice(0, ASSETS_PER_USER);

    const user = await prisma.user.create({
      data: {
        email: `${PREFIX.toLowerCase()}-user-${String(u + 1).padStart(2, '0')}@beathive.test`,
        name: `Simulated Evaluation User ${String(u + 1).padStart(2, '0')}`,
        passwordHash,
        role: 'USER',
        provider: 'email',
        emailVerified: true,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            currentPeriodEnd: daysAgo(-365),
          },
        },
      },
    });
    users.push({ user, preferredAssets });

    const logs = [];
    const wishlistRows = [];
    const ratingRows = [];
    const downloadRows = [];
    const orderRows = [];

    for (const [idx, asset] of preferredAssets.entries()) {
      const isHoldout = idx >= ASSETS_PER_USER - HOLDOUT_PER_USER;
      const baseDay = ASSETS_PER_USER - idx + u;
      const actions = isHoldout
        ? ['download', 'purchase']
        : ['search', 'click', 'play', 'play_long', 'wishlist', 'cart', 'download', 'purchase'];
      for (const [actionIndex, action] of actions.entries()) {
        logs.push({
          userId: user.id,
          audioAssetId: action === 'search' ? null : asset.id,
          action,
          weight: ACTION_WEIGHTS[action],
          searchQuery: action === 'search' ? `${cluster.title} ${cluster.subcategory}` : null,
          categorySlug: pick(CLUSTERS, u).category[0],
          tagSlugs: CLUSTERS.find((c) => c.slug === asset.clusterSlug).tags,
          moodValue: CLUSTERS.find((c) => c.slug === asset.clusterSlug).mood,
          sessionId: `${PREFIX}:user-${u + 1}:session-${Math.floor(idx / 8) + 1}`,
          createdAt: daysAgo(baseDay, actionIndex * 9),
        });
      }

      if (!isHoldout || idx % 2 === 0) {
        wishlistRows.push({ userId: user.id, audioAssetId: asset.id, createdAt: daysAgo(baseDay, 20) });
      }
      ratingRows.push({
        userId: user.id,
        audioAssetId: asset.id,
        score: isHoldout ? 5 : 4 + (idx % 2),
        reviewText: `Simulated evaluation rating for ${asset.title}`,
        createdAt: daysAgo(baseDay, 30),
        updatedAt: daysAgo(baseDay, 30),
      });
      downloadRows.push({
        userId: user.id,
        audioAssetId: asset.id,
        source: idx % 3 === 0 ? 'purchase' : 'subscription',
        signedUrl: `/simulation/${PREFIX}/downloads/${user.id}/${asset.slug}.wav`,
        expiresAt: daysAgo(baseDay - 1),
        downloadedAt: daysAgo(baseDay, 40),
      });
      if (idx < 20) orderRows.push(asset);
    }

    await prisma.userBehaviorLog.createMany({ data: logs });
    await prisma.wishlist.createMany({ data: wishlistRows, skipDuplicates: true });
    await prisma.rating.createMany({ data: ratingRows, skipDuplicates: true });
    await prisma.download.createMany({ data: downloadRows });

    for (const [idx, asset] of orderRows.entries()) {
      const orderId = crypto.randomUUID();
      const createdAt = daysAgo(ASSETS_PER_USER - idx + u, idx);
      await prisma.order.create({
        data: {
          id: orderId,
          userId: user.id,
          totalAmount: asset.price + 2500,
          status: 'PAID',
          gatewayOrderId: `${PREFIX}-ORDER-${u + 1}-${idx + 1}`,
          snapToken: `${PREFIX.toLowerCase()}-snap-${u + 1}-${idx + 1}`,
          paidAt: createdAt,
          createdAt,
          updatedAt: createdAt,
          items: {
            create: {
              audioAssetId: asset.id,
              priceSnapshot: asset.price,
              licenseType: idx % 4 === 0 ? 'commercial' : 'personal',
              licensePdfUrl: `/simulation/${PREFIX}/licenses/${orderId}.pdf`,
            },
          },
          invoice: {
            create: {
              invoiceNumber: `INV-${PREFIX}-${String(u + 1).padStart(2, '0')}-${String(idx + 1).padStart(3, '0')}`,
              pdfUrl: `/simulation/${PREFIX}/invoices/${orderId}.pdf`,
              issuedAt: createdAt,
            },
          },
        },
      });
    }
  }
  return users;
}

async function evaluate(users, allAssets) {
  const fullAssets = await prisma.audioAsset.findMany({
    where: { slug: { startsWith: `${PREFIX.toLowerCase()}-` } },
    include: {
      category: { select: { slug: true } },
      tags: { select: { tag: { select: { slug: true } } } },
      sfxMetadata: true,
    },
  });
  const metrics = [];

  for (const { user } of users) {
    const downloads = await prisma.download.findMany({
      where: { userId: user.id },
      orderBy: { downloadedAt: 'asc' },
      select: { audioAssetId: true },
    });
    const split = Math.floor(downloads.length * 0.8);
    const train = new Set(downloads.slice(0, split).map((d) => d.audioAssetId));
    const relevant = new Set(downloads.slice(split).map((d) => d.audioAssetId));
    const trainLogs = await prisma.userBehaviorLog.findMany({
      where: { userId: user.id, audioAssetId: { in: [...train] } },
    });
    const assetById = new Map(fullAssets.map((asset) => [asset.id, asset]));
    const profile = {
      categories: new Map(),
      tags: new Map(),
      moods: new Map(),
      subcategories: new Map(),
    };
    for (const log of trainLogs) {
      const asset = assetById.get(log.audioAssetId);
      if (!asset) continue;
      profile.categories.set(asset.category.slug, (profile.categories.get(asset.category.slug) ?? 0) + log.weight);
      profile.moods.set(asset.mood, (profile.moods.get(asset.mood) ?? 0) + log.weight);
      profile.subcategories.set(asset.sfxMetadata?.subcategory, (profile.subcategories.get(asset.sfxMetadata?.subcategory) ?? 0) + log.weight);
      for (const tag of asset.tags.map((entry) => entry.tag.slug)) {
        profile.tags.set(tag, (profile.tags.get(tag) ?? 0) + log.weight);
      }
    }
    const recommended = fullAssets
      .filter((asset) => !train.has(asset.id))
      .map((asset) => ({ id: asset.id, score: scoreCandidate(profile, asset) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.id);
    metrics.push(metricForUser(relevant, recommended, 10));
  }

  const avg = (key) => metrics.reduce((sum, item) => sum + item[key], 0) / metrics.length;
  return {
    usersEvaluated: metrics.length,
    k: 10,
    precisionAt10: avg('precision'),
    recallAt10: avg('recall'),
    ndcgAt10: avg('ndcg'),
    mapAt10: avg('averagePrecision'),
  };
}

async function summarize(evaluation) {
  const [
    users,
    assets,
    logs,
    downloads,
    wishlists,
    ratings,
    paidOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { email: { startsWith: `${PREFIX.toLowerCase()}-user-` } } }),
    prisma.audioAsset.count({ where: { slug: { startsWith: `${PREFIX.toLowerCase()}-` } } }),
    prisma.userBehaviorLog.count({ where: { sessionId: { startsWith: PREFIX } } }),
    prisma.download.count({ where: { signedUrl: { startsWith: `/simulation/${PREFIX}/` } } }),
    prisma.wishlist.count({ where: { user: { email: { startsWith: `${PREFIX.toLowerCase()}-user-` } } } }),
    prisma.rating.count({ where: { user: { email: { startsWith: `${PREFIX.toLowerCase()}-user-` } } } }),
    prisma.order.count({ where: { gatewayOrderId: { startsWith: PREFIX } } }),
  ]);
  return {
    label: 'Simulated BeatHive recommendation evaluation dataset',
    prefix: PREFIX,
    users,
    assets,
    behaviorLogs: logs,
    downloads,
    wishlists,
    ratings,
    paidOrders,
    evaluation,
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Preparing ${PREFIX} evaluation dataset...`);
  const { freePlan } = await ensureBaseData();
  await cleanupUsers();
  const assets = await seedAssets();
  const users = await seedUsersAndInteractions(freePlan, assets);
  const evaluation = await evaluate(users, assets);
  const summary = await summarize(evaluation);
  const outPath = path.join(__dirname, '..', 'evaluation-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved summary: ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

