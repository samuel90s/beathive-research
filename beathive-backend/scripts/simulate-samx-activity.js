const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const EMAIL = 'samx@gmail.com';
const PASSWORD = 'password123';
const SIM_PREFIX = 'SIM-SAMX';
const SIM_SESSION = 'simulation:samx:recommendation-demo';
const TARGET_COUNT = 50;

const BEHAVIOR_WEIGHTS = {
  wishlist: 4,
  cart: 5,
  download: 6,
  purchase: 6,
};

function daysAgo(days, extraMinutes = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - extraMinutes * 60 * 1000);
}

function invoiceNumber(orderId, index) {
  const year = new Date().getFullYear();
  return `INV-${year}-${SIM_PREFIX}-${String(index + 1).padStart(3, '0')}-${orderId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function calcOrderTotal(price) {
  const subtotal = Math.max(price, 10000);
  const serviceFee = Math.round(subtotal * 0.05);
  const tax = Math.round((subtotal + serviceFee) * 0.11);
  return { subtotal, total: subtotal + serviceFee + tax };
}

async function ensureUser() {
  const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      name: 'Samx Demo User',
      passwordHash,
      provider: 'email',
      emailVerified: true,
    },
    create: {
      email: EMAIL,
      name: 'Samx Demo User',
      passwordHash,
      role: 'USER',
      provider: 'email',
      emailVerified: true,
    },
  });

  if (freePlan) {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        planId: freePlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  return user;
}

async function cleanup(userId) {
  const simulatedOrders = await prisma.order.findMany({
    where: { userId, gatewayOrderId: { startsWith: SIM_PREFIX } },
    select: { id: true },
  });
  const orderIds = simulatedOrders.map((order) => order.id);

  if (orderIds.length > 0) {
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  await prisma.download.deleteMany({
    where: {
      userId,
      signedUrl: { startsWith: `/demo/${SIM_PREFIX}/` },
    },
  });

  await prisma.userBehaviorLog.deleteMany({
    where: { userId, sessionId: SIM_SESSION },
  });
}

async function getAssets() {
  const assets = await prisma.audioAsset.findMany({
    where: {
      isPublished: true,
      category: { type: 'sfx' },
    },
    orderBy: [{ category: { slug: 'asc' } }, { title: 'asc' }],
    take: TARGET_COUNT,
    include: {
      category: { select: { slug: true } },
      tags: { select: { tag: { select: { slug: true } } } },
    },
  });

  if (assets.length < TARGET_COUNT) {
    throw new Error(`Need at least ${TARGET_COUNT} published SFX assets, found ${assets.length}. Run SEED_DUMMY_DATA=true npm run prisma:seed first.`);
  }

  return assets;
}

async function createOrders(userId, assets) {
  let created = 0;
  for (const [index, asset] of assets.entries()) {
    const orderId = crypto.randomUUID();
    const paidAt = daysAgo(TARGET_COUNT - index, index * 7);
    const licenseType = index % 4 === 0 ? 'commercial' : 'personal';
    const basePrice = asset.price > 0 ? asset.price : 10000 + (index % 5) * 5000;
    const priceSnapshot = licenseType === 'commercial' ? basePrice * 2 : basePrice;
    const { total } = calcOrderTotal(priceSnapshot);

    await prisma.order.create({
      data: {
        id: orderId,
        userId,
        totalAmount: total,
        status: 'PAID',
        gatewayOrderId: `${SIM_PREFIX}-ORDER-${String(index + 1).padStart(3, '0')}`,
        snapToken: `demo-snap-token-${SIM_PREFIX.toLowerCase()}-${String(index + 1).padStart(3, '0')}`,
        paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
        items: {
          create: {
            audioAssetId: asset.id,
            priceSnapshot,
            licenseType,
            licensePdfUrl: `/demo/${SIM_PREFIX}/licenses/${asset.slug}-${licenseType}.pdf`,
          },
        },
        invoice: {
          create: {
            invoiceNumber: invoiceNumber(orderId, index),
            pdfUrl: `/demo/${SIM_PREFIX}/invoices/${orderId}.pdf`,
            issuedAt: paidAt,
          },
        },
      },
    });
    created += 1;
  }
  return created;
}

async function createDownloads(userId, assets) {
  let created = 0;
  for (const [index, asset] of assets.entries()) {
    const downloadedAt = daysAgo(TARGET_COUNT - index, index * 5);
    await prisma.download.create({
      data: {
        userId,
        audioAssetId: asset.id,
        source: 'purchase',
        signedUrl: `/demo/${SIM_PREFIX}/downloads/${asset.slug}.${asset.format || 'wav'}`,
        expiresAt: new Date(downloadedAt.getTime() + 24 * 60 * 60 * 1000),
        downloadedAt,
      },
    });
    created += 1;
  }
  return created;
}

async function createWishlists(userId, assets) {
  let touched = 0;
  for (const [index, asset] of assets.entries()) {
    await prisma.wishlist.upsert({
      where: { userId_audioAssetId: { userId, audioAssetId: asset.id } },
      update: {},
      create: {
        userId,
        audioAssetId: asset.id,
        createdAt: daysAgo(TARGET_COUNT - index, index * 3),
      },
    });
    touched += 1;
  }
  return touched;
}

async function createBehaviorLogs(userId, assets) {
  const logs = [];
  const actions = ['cart', 'wishlist', 'download', 'purchase'];

  for (const [assetIndex, asset] of assets.entries()) {
    for (const [actionIndex, action] of actions.entries()) {
      logs.push({
        userId,
        audioAssetId: asset.id,
        action,
        weight: BEHAVIOR_WEIGHTS[action],
        searchQuery: null,
        categorySlug: asset.category.slug,
        tagSlugs: asset.tags.map((entry) => entry.tag.slug),
        moodValue: asset.mood,
        sessionId: SIM_SESSION,
        createdAt: daysAgo(TARGET_COUNT - assetIndex, actionIndex * 11),
      });
    }
  }

  await prisma.userBehaviorLog.createMany({ data: logs });
  return logs.length;
}

async function main() {
  console.log(`Simulating recommendation activity for ${EMAIL}`);
  const user = await ensureUser();
  const assets = await getAssets();

  await cleanup(user.id);

  const orders = await createOrders(user.id, assets);
  const downloads = await createDownloads(user.id, assets);
  const wishlists = await createWishlists(user.id, assets);
  const logs = await createBehaviorLogs(user.id, assets);

  console.log(`User: ${EMAIL}`);
  console.log(`Orders paid: ${orders}`);
  console.log(`Downloads: ${downloads}`);
  console.log(`Wishlist items touched: ${wishlists}`);
  console.log(`Behavior logs: ${logs} (${TARGET_COUNT} each for cart, wishlist, download, purchase)`);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
