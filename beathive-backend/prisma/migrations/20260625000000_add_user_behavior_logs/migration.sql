CREATE TABLE "user_behavior_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "audioAssetId" TEXT,
  "action" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "searchQuery" TEXT,
  "categorySlug" TEXT,
  "tagSlugs" TEXT[] NOT NULL,
  "moodValue" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_behavior_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_behavior_logs_userId_createdAt_idx" ON "user_behavior_logs"("userId", "createdAt");
CREATE INDEX "user_behavior_logs_userId_audioAssetId_idx" ON "user_behavior_logs"("userId", "audioAssetId");
CREATE INDEX "user_behavior_logs_action_idx" ON "user_behavior_logs"("action");

ALTER TABLE "user_behavior_logs"
ADD CONSTRAINT "user_behavior_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
