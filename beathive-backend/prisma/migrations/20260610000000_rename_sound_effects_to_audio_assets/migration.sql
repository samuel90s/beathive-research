-- Rename the audio catalog storage to the more general audio_assets model.
-- This intentionally clears existing SFX/music catalog data and dependent
-- transactional records so the app starts fresh on the new physical table shape.

DELETE FROM "ratings";
DELETE FROM "wishlists";
DELETE FROM "downloads";
DELETE FROM "creator_earnings";
UPDATE "creator_wallets" SET "balance" = 0, "totalEarned" = 0;

DELETE FROM "sound_effect_tags";
DELETE FROM "sound_genres";
DELETE FROM "sfx_metadata";
DELETE FROM "music_metadata";
DELETE FROM "order_items";
DELETE FROM "invoices";
DELETE FROM "orders";
DELETE FROM "sound_effects";

ALTER TABLE "sound_effects" ADD COLUMN IF NOT EXISTS "assetType" TEXT NOT NULL DEFAULT 'SFX';

ALTER TABLE "sound_effects" RENAME TO "audio_assets";
ALTER TABLE "sound_effect_tags" RENAME TO "audio_asset_tags";
ALTER TABLE "sound_genres" RENAME TO "audio_asset_genres";

ALTER TABLE "audio_asset_tags" RENAME COLUMN "soundEffectId" TO "audioAssetId";
ALTER TABLE "audio_asset_genres" RENAME COLUMN "soundId" TO "assetId";
ALTER TABLE "sfx_metadata" RENAME COLUMN "soundId" TO "assetId";
ALTER TABLE "music_metadata" RENAME COLUMN "soundId" TO "assetId";
ALTER TABLE "order_items" RENAME COLUMN "soundEffectId" TO "audioAssetId";
ALTER TABLE "downloads" RENAME COLUMN "soundEffectId" TO "audioAssetId";
ALTER TABLE "wishlists" RENAME COLUMN "soundEffectId" TO "audioAssetId";
ALTER TABLE "ratings" RENAME COLUMN "soundId" TO "audioAssetId";
ALTER TABLE "creator_earnings" RENAME COLUMN "soundId" TO "audioAssetId";

CREATE INDEX IF NOT EXISTS "audio_assets_assetType_idx" ON "audio_assets"("assetType");
CREATE INDEX IF NOT EXISTS "audio_assets_isPublished_categoryId_idx" ON "audio_assets"("isPublished", "categoryId");
CREATE INDEX IF NOT EXISTS "audio_assets_authorId_idx" ON "audio_assets"("authorId");
CREATE INDEX IF NOT EXISTS "audio_assets_accessLevel_idx" ON "audio_assets"("accessLevel");
CREATE INDEX IF NOT EXISTS "audio_assets_isPublished_accessLevel_idx" ON "audio_assets"("isPublished", "accessLevel");
CREATE INDEX IF NOT EXISTS "downloads_audioAssetId_idx" ON "downloads"("audioAssetId");
CREATE INDEX IF NOT EXISTS "audio_asset_genres_genreId_idx" ON "audio_asset_genres"("genreId");
