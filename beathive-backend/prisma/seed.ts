import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Plans ──────────────────────────────────────────────────
  const plans = [
    { name: 'Free', slug: 'free', priceMonthly: 0,     priceYearly: 0,      downloadLimit: 3,  commercialLicense: false, unlimited: false },
    { name: 'Pro',  slug: 'pro',  priceMonthly: 25000, priceYearly: 220000, downloadLimit: 20, commercialLicense: true,  unlimited: false },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({ where: { slug: plan.slug }, update: plan, create: plan })
  }
  console.log('✓ Plans seeded')

  // ─── Categories ─────────────────────────────────────────────
  const categories = [
    // SFX
    { slug: 'foley',            name: 'Foley',              type: 'sfx'   },
    { slug: 'ambience',         name: 'Ambience',            type: 'sfx'   },
    { slug: 'soundscape',       name: 'Soundscape',          type: 'sfx'   },
    { slug: 'nature',           name: 'Nature & Weather',    type: 'sfx'   },
    { slug: 'explosions',       name: 'Explosions',          type: 'sfx'   },
    { slug: 'weapons',          name: 'Weapons & Combat',    type: 'sfx'   },
    { slug: 'vehicles',         name: 'Vehicles',            type: 'sfx'   },
    { slug: 'ui-game',          name: 'UI & Game',           type: 'sfx'   },
    { slug: 'horror',           name: 'Horror',              type: 'sfx'   },
    { slug: 'human',            name: 'Human & Crowd',       type: 'sfx'   },
    { slug: 'animals',          name: 'Animals',             type: 'sfx'   },
    { slug: 'electronic',       name: 'Electronic & Sci-Fi', type: 'sfx'   },
    { slug: 'comedy',           name: 'Comedy & Cartoon',    type: 'sfx'   },
    { slug: 'magic',            name: 'Magic & Fantasy',     type: 'sfx'   },
    { slug: 'sports',           name: 'Sports & Action',     type: 'sfx'   },
    { slug: 'industrial',       name: 'Industrial',          type: 'sfx'   },
    // Music
    { slug: 'sound-scoring',    name: 'Sound Scoring',       type: 'music' },
    { slug: 'cinematic',        name: 'Cinematic',           type: 'music' },
    { slug: 'electronic-music', name: 'Electronic Music',    type: 'music' },
    { slug: 'acoustic',         name: 'Acoustic',            type: 'music' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: { name: cat.name, type: cat.type },
      create: cat,
    })
  }
  console.log('✓ Categories seeded')

  // ─── Tags ───────────────────────────────────────────────────
  const tagNames = [
    'explosion', 'gunshot', 'footstep', 'rain', 'thunder', 'wind',
    'fire', 'water', 'crowd', 'applause', 'click', 'notification',
    'whoosh', 'impact', 'loop', 'short', 'long', 'loud', 'soft',
    'realistic', 'sfx', 'music', 'ambient', 'cinematic', 'epic',
    'transition', 'sweep', 'rocket', 'swoosh', 'drum', 'brass',
    'orchestra', 'reverb', 'dark', 'horror', 'glitch', 'electronic',
    'nature', 'bird', 'forest', 'ocean', 'car', 'engine', 'weapon',
    'sword', 'magic', 'spell', 'ui', 'game', 'comedy', 'cartoon',
    'punch', 'hit', 'bounce', 'glass', 'metal', 'wood', 'paper',
    'sci-fi',
  ]

  for (const name of tagNames) {
    const tagSlug = name.replace(/\s+/g, '-')
    await prisma.tag.upsert({
      where:  { slug: tagSlug },
      update: { name },
      create: { name, slug: tagSlug },
    })
  }
  console.log('✓ Tags seeded')

  // ─── Music genres ────────────────────────────────────────────
  const musicGenres = [
    'Cinematic', 'Orchestral', 'Trailer', 'Ambient', 'Lo-fi', 'EDM',
    'Hip Hop', 'Trap', 'Acoustic', 'Piano', 'Corporate', 'Rock', 'Jazz',
    'Electronic',
  ]

  for (const name of musicGenres) {
    const genreSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await prisma.genre.upsert({
      where:  { slug: genreSlug },
      update: { name },
      create: { name, slug: genreSlug },
    })
  }
  console.log('✓ Music genres seeded')

  console.log('\n✅ Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
