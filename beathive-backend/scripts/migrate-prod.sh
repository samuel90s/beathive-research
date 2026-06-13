#!/bin/sh
# ─── Arsonus — Production Database Migration ────────────
# Usage: ./scripts/migrate-prod.sh
#
# This script runs Prisma migrations in production mode.
# It uses 'migrate deploy' (not 'migrate dev') which is safe for production.

set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete!"

# Optional: Seed database if SEED_DB=true
if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Seeding database..."
  npx tsx prisma/seed.ts
  echo "✅ Seed complete!"
fi

echo "🚀 Database is ready for production."
