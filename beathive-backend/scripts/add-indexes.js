const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_author_id ON audio_assets("authorId")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_asset_type ON audio_assets("assetType")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_access_level ON audio_assets("accessLevel")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_published_access ON audio_assets("isPublished", "accessLevel")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_download_count ON audio_assets("downloadCount")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_play_count ON audio_assets("playCount")',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_created_at ON audio_assets("createdAt")',
    'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders("userId")',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON orders("gatewayOrderId")',
    'CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads("userId")',
    'CREATE INDEX IF NOT EXISTS idx_downloads_audio_asset_id ON downloads("audioAssetId")',
    'CREATE INDEX IF NOT EXISTS idx_downloads_user_downloaded ON downloads("userId", "downloadedAt")',
    'CREATE INDEX IF NOT EXISTS idx_creator_earnings_wallet_earned ON creator_earnings("walletId", "earnedAt")',
    'CREATE INDEX IF NOT EXISTS idx_creator_earnings_download_id ON creator_earnings("downloadId")',
  ];

  for (const sql of indexes) {
    const name = sql.match(/idx_\w+/)?.[0] ?? 'unknown';
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✓', name);
    } catch (e) {
      console.log('skip', name, '-', e.message.split('\n')[0]);
    }
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
