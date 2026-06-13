// scripts/clear-sounds.js
// Hapus semua audio assets + data terkait (orders, downloads, ratings, dll).
// Tetap mempertahankan: users, plans, categories, tags, subscriptions.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Menghapus semua audio assets dan data terkait...\n');

  const ratings = await prisma.rating.deleteMany({});
  console.log(`Ratings          : ${ratings.count} dihapus`);

  const wishlists = await prisma.wishlist.deleteMany({});
  console.log(`Wishlists        : ${wishlists.count} dihapus`);

  const downloads = await prisma.download.deleteMany({});
  console.log(`Downloads        : ${downloads.count} dihapus`);

  const earnings = await prisma.creatorEarning.deleteMany({});
  console.log(`Creator Earnings : ${earnings.count} dihapus`);

  const wallets = await prisma.creatorWallet.updateMany({
    data: { balance: 0, totalEarned: 0 },
  });
  console.log(`Creator Wallets  : ${wallets.count} direset ke 0`);

  const assetTags = await prisma.audioAssetOnTag.deleteMany({});
  console.log(`Audio Tags       : ${assetTags.count} dihapus`);

  const assetGenres = await prisma.audioAssetGenre.deleteMany({});
  console.log(`Audio Genres     : ${assetGenres.count} dihapus`);

  const sfxMetadata = await prisma.sfxMetadata.deleteMany({});
  console.log(`SFX Metadata     : ${sfxMetadata.count} dihapus`);

  const musicMetadata = await prisma.musicMetadata.deleteMany({});
  console.log(`Music Metadata   : ${musicMetadata.count} dihapus`);

  const orderItems = await prisma.orderItem.deleteMany({});
  console.log(`Order Items      : ${orderItems.count} dihapus`);

  const invoices = await prisma.invoice.deleteMany({});
  console.log(`Invoices         : ${invoices.count} dihapus`);

  const orders = await prisma.order.deleteMany({});
  console.log(`Orders           : ${orders.count} dihapus`);

  const assets = await prisma.audioAsset.deleteMany({});
  console.log(`Audio Assets     : ${assets.count} dihapus`);

  console.log('\nSelesai! Database bersih, siap untuk testing dengan real audio.');
  console.log('(Users, plans, categories, tags, subscriptions tetap ada)');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
