import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Plans ──────────────────────────────────────────────────
  const plans = [
    { name: 'Free', slug: 'free', priceMonthly: 0,     priceYearly: 0,      downloadLimit: 3,  commercialLicense: false, unlimited: false },
    { name: 'Pro',  slug: 'pro',  priceMonthly: 25000, priceYearly: 220000, downloadLimit: 20, commercialLicense: true,  unlimited: false },
    { name: 'Business', slug: 'business', priceMonthly: 299000, priceYearly: 2500000, downloadLimit: -1, commercialLicense: true, unlimited: true },
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
    { slug: 'game-music',       name: 'Game Music',          type: 'music' },
    { slug: 'cinematic',        name: 'Cinematic',           type: 'music' },
    { slug: 'ambient-music',    name: 'Ambient Music',       type: 'music' },
    { slug: 'electronic-music', name: 'Electronic Music',    type: 'music' },
    { slug: 'acoustic',         name: 'Acoustic',            type: 'music' },
    { slug: 'corporate',        name: 'Corporate',           type: 'music' },
    { slug: 'lo-fi',            name: 'Lo-fi',               type: 'music' },
    { slug: 'hip-hop',          name: 'Hip-Hop',             type: 'music' },
    { slug: 'rock',             name: 'Rock',                type: 'music' },
    { slug: 'pop',              name: 'Pop',                 type: 'music' },
    { slug: 'jazz',             name: 'Jazz',                type: 'music' },
    { slug: 'classical',        name: 'Classical',           type: 'music' },
    { slug: 'fantasy-music',    name: 'Fantasy Music',       type: 'music' },
    { slug: 'kids-music',       name: 'Kids Music',          type: 'music' },
    { slug: 'podcast-music',    name: 'Podcast Music',       type: 'music' },
    { slug: 'trailer-music',    name: 'Trailer Music',       type: 'music' },
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

  // ─── Admin account ──────────────────────────────────────────
  const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } })

  const adminEmail    = 'admin@beathive.com'
  const adminPassword = 'password123'
  const admin = await prisma.user.upsert({
    where:  { email: adminEmail },
    update: {},
    create: {
      email:        adminEmail,
      name:         'Admin BeatHive',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role:         'ADMIN',
      provider:     'email',
    },
  })
  if (freePlan) {
    await prisma.subscription.upsert({
      where:  { userId: admin.id },
      update: {},
      create: {
        userId:           admin.id,
        planId:           freePlan.id,
        status:           'ACTIVE',
        billingCycle:     'MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
  }
  console.log(`✓ Admin  → ${adminEmail} / ${adminPassword}`)

  // ─── Dummy Audio Assets ───────────────────────────────────
  // Generate fake waveform data (array of bar heights)
  if (process.env.SEED_DUMMY_DATA !== 'true') {
    console.log('Dummy audio dilewati. Set SEED_DUMMY_DATA=true untuk data demo.')
    return
  }

  const fakeWaveform = (len = 80) =>
    Array.from({ length: len }, () => Math.round(Math.random() * 100))

  // Fetch category & tag references
  const catMap: Record<string, string> = {}
  const allCats = await prisma.category.findMany()
  for (const c of allCats) catMap[c.slug] = c.id

  const tagMap: Record<string, string> = {}
  const allTags = await prisma.tag.findMany()
  for (const t of allTags) tagMap[t.slug] = t.id

  const genreMap: Record<string, string> = {}
  const allGenres = await prisma.genre.findMany()
  for (const g of allGenres) genreMap[g.slug] = g.id

  // ── SFX Assets ────────────────────────────────────────────
  const sfxCatalog = [
    {
      categorySlug: 'foley',
      subcategories: ['Footsteps', 'Clothing', 'Impact', 'Paper', 'Glass'],
      tags: ['footstep', 'realistic', 'short', 'sfx', 'impact', 'paper', 'glass'],
      mood: 'neutral',
      titles: ['Soft Footsteps on Wood', 'Jacket Cloth Movement', 'Ceramic Cup Impact', 'Paper Bag Rustle', 'Glass Bottle Set Down'],
    },
    {
      categorySlug: 'ambience',
      subcategories: ['Indoor', 'Outdoor', 'Urban', 'Underwater', 'Weather'],
      tags: ['ambient', 'loop', 'long', 'rain', 'wind', 'water', 'crowd'],
      mood: 'calm',
      titles: ['Quiet Apartment Room Tone', 'Open Park Afternoon', 'Dense City Sidewalk', 'Underwater Pool Bed', 'Light Rain Window Loop'],
    },
    {
      categorySlug: 'soundscape',
      subcategories: ['Forest', 'Ocean', 'City', 'Space', 'Post-Apocalyptic'],
      tags: ['ambient', 'loop', 'forest', 'ocean', 'sci-fi', 'dark', 'wind'],
      mood: 'dark',
      titles: ['Forest Dawn Soundscape', 'Wide Ocean Shoreline', 'Distant Neon City', 'Outer Space Drone Field', 'Abandoned Wasteland Wind'],
    },
    {
      categorySlug: 'nature',
      subcategories: ['Rain', 'Wind', 'Thunder', 'Fire', 'Water'],
      tags: ['nature', 'rain', 'wind', 'thunder', 'fire', 'water', 'loop'],
      mood: 'calm',
      titles: ['Gentle Rain on Leaves', 'Cold Mountain Wind', 'Rolling Thunder Distance', 'Small Campfire Crackle', 'Creek Water Flow'],
    },
    {
      categorySlug: 'explosions',
      subcategories: ['Small', 'Large', 'Impact', 'Debris', 'Distant'],
      tags: ['explosion', 'impact', 'loud', 'cinematic', 'fire', 'hit'],
      mood: 'epic',
      titles: ['Small Dust Burst', 'Large Cinematic Blast', 'Concrete Impact Boom', 'Debris Shower Aftermath', 'Distant Battlefield Explosion'],
    },
    {
      categorySlug: 'weapons',
      subcategories: ['Guns', 'Blades', 'Bows', 'Futuristic', 'Impact'],
      tags: ['weapon', 'gunshot', 'sword', 'impact', 'sci-fi', 'metal', 'hit'],
      mood: 'tense',
      titles: ['Pistol Shot Close', 'Sword Unsheathe Clean', 'Arrow Flyby Fast', 'Laser Rifle Charge', 'Shield Metal Impact'],
    },
    {
      categorySlug: 'vehicles',
      subcategories: ['Car', 'Motorcycle', 'Truck', 'Aircraft', 'Boat'],
      tags: ['car', 'engine', 'loud', 'realistic', 'loop', 'water'],
      mood: 'neutral',
      titles: ['Car Engine Idle Loop', 'Motorcycle Pass By', 'Heavy Truck Brake', 'Jet Flyover Distance', 'Small Boat Motor Wake'],
    },
    {
      categorySlug: 'ui-game',
      subcategories: ['Click', 'Notification', 'Alert', 'Power-up', 'Menu'],
      tags: ['ui', 'game', 'click', 'notification', 'short', 'electronic', 'sfx'],
      mood: 'happy',
      titles: ['Clean Button Click', 'Soft Notification Ping', 'Warning Alert Pulse', 'Arcade Power Up', 'Menu Select Blip'],
    },
    {
      categorySlug: 'horror',
      subcategories: ['Suspense', 'Jump Scare', 'Ambient', 'Monster', 'Breathing'],
      tags: ['horror', 'dark', 'ambient', 'impact', 'reverb', 'sfx'],
      mood: 'dark',
      titles: ['Low Suspense Drone', 'Sharp Jump Scare Hit', 'Haunted Basement Ambience', 'Creature Growl Layer', 'Close Scared Breathing'],
    },
    {
      categorySlug: 'human',
      subcategories: ['Footsteps', 'Breathing', 'Crowd', 'Laughter', 'Voice'],
      tags: ['footstep', 'crowd', 'applause', 'realistic', 'short', 'soft'],
      mood: 'neutral',
      titles: ['Sneaker Steps Hallway', 'Tired Breathing Close', 'Small Crowd Murmur', 'Friendly Group Laughter', 'Voice Effort Grunt'],
    },
    {
      categorySlug: 'animals',
      subcategories: ['Dog', 'Cat', 'Bird', 'Wild', 'Insects'],
      tags: ['nature', 'bird', 'forest', 'realistic', 'short', 'ambient'],
      mood: 'neutral',
      titles: ['Dog Bark Single', 'Cat Meow Close', 'Morning Bird Chirps', 'Wild Animal Snarl', 'Night Insects Loop'],
    },
    {
      categorySlug: 'electronic',
      subcategories: ['Robot', 'Computer', 'Glitch', 'Machine', 'Sci-Fi'],
      tags: ['electronic', 'sci-fi', 'glitch', 'loop', 'short', 'dark'],
      mood: 'tense',
      titles: ['Robot Servo Move', 'Computer Boot Sequence', 'Digital Glitch Burst', 'Machine Scanner Loop', 'Sci-Fi Door Open'],
    },
    {
      categorySlug: 'comedy',
      subcategories: ['Cartoon', 'Boing', 'Pop', 'Slide Whistle', 'Impact'],
      tags: ['comedy', 'cartoon', 'bounce', 'impact', 'short', 'sfx'],
      mood: 'happy',
      titles: ['Cartoon Slip Fall', 'Rubber Boing Hit', 'Tiny Pop Accent', 'Slide Whistle Down', 'Silly Impact Bonk'],
    },
    {
      categorySlug: 'magic',
      subcategories: ['Spell', 'Enchant', 'Fantasy', 'Mystical', 'Impact'],
      tags: ['magic', 'spell', 'whoosh', 'reverb', 'cinematic', 'sfx'],
      mood: 'epic',
      titles: ['Sparkle Spell Cast', 'Enchanted Aura Loop', 'Fantasy Portal Open', 'Mystical Whoosh Sweep', 'Magic Impact Burst'],
    },
    {
      categorySlug: 'sports',
      subcategories: ['Ball', 'Whistle', 'Crowd', 'Impact', 'Movement'],
      tags: ['hit', 'impact', 'crowd', 'short', 'loud', 'realistic'],
      mood: 'upbeat',
      titles: ['Basketball Bounce Court', 'Referee Whistle Sharp', 'Stadium Crowd Cheer', 'Body Tackle Impact', 'Fast Whoosh Movement'],
    },
    {
      categorySlug: 'industrial',
      subcategories: ['Factory', 'Machine', 'Metal', 'Construction', 'Alarm'],
      tags: ['metal', 'impact', 'loop', 'loud', 'realistic', 'electronic'],
      mood: 'tense',
      titles: ['Factory Conveyor Loop', 'Hydraulic Machine Press', 'Metal Pipe Drop', 'Construction Drill Burst', 'Industrial Warning Alarm'],
    },
  ] as const

  const accessCycle = ['FREE', 'PRO', 'PURCHASE', 'FREE', 'PRO'] as const
  const sfxAssets = sfxCatalog.flatMap((category) =>
    category.titles.map((title, index) => {
      const slugTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const accessLevel = accessCycle[index]
      return {
        slug: `sfx-${category.categorySlug}-${slugTitle}`,
        title,
        description: `Demo SFX for ${category.categorySlug.replace(/-/g, ' ')}: ${title}. Useful for testing browse, detail, recommendation, and similar sound flows.`,
        categorySlug: category.categorySlug,
        accessLevel,
        price: accessLevel === 'PURCHASE' ? 15000 + index * 5000 : 0,
        durationMs: 2500 + index * 7200 + category.categorySlug.length * 120,
        fileSize: 450000 + index * 260000 + category.categorySlug.length * 11000,
        format: index % 2 === 0 ? 'wav' : 'mp3',
        tags: category.tags.slice(index, index + 4).length >= 3 ? category.tags.slice(index, index + 4) : category.tags.slice(0, 4),
        subcategory: category.subcategories[index],
        mood: category.mood,
      }
    }),
  )

  for (const sfx of sfxAssets) {
    const existing = await prisma.audioAsset.findUnique({ where: { slug: sfx.slug } })
    if (existing) {
      console.log(`  ⏭ SFX "${sfx.title}" already exists, skipping`)
      continue
    }

    const asset = await prisma.audioAsset.create({
      data: {
        assetType: 'SFX',
        categoryId: catMap[sfx.categorySlug],
        authorId: admin.id,
        title: sfx.title,
        slug: sfx.slug,
        description: sfx.description,
        fileUrl: `/uploads/sfx/${sfx.slug}.wav`,
        previewUrl: `/uploads/sfx/preview/${sfx.slug}.mp3`,
        waveformData: fakeWaveform(),
        durationMs: sfx.durationMs,
        fileSize: sfx.fileSize,
        format: sfx.format,
        price: sfx.price,
        accessLevel: sfx.accessLevel,
        mood: sfx.mood,
        licenseType: sfx.accessLevel === 'PRO' ? 'commercial' : 'personal',
        isPublished: true,
        publishedAt: new Date(),
        reviewStatus: 'APPROVED',
        reviewedAt: new Date(),
        playCount: Math.floor(Math.random() * 500),
        downloadCount: Math.floor(Math.random() * 200),
      },
    })

    // Connect tags
    for (const tagName of sfx.tags) {
      if (tagMap[tagName]) {
        await prisma.audioAssetOnTag.create({
          data: { audioAssetId: asset.id, tagId: tagMap[tagName] },
        })
      }
    }

    // Create SFX metadata
    await prisma.sfxMetadata.create({
      data: { assetId: asset.id, subcategory: sfx.subcategory },
    })

    console.log(`  ✓ SFX "${sfx.title}" [${sfx.accessLevel}]`)
  }
  console.log('✓ SFX assets seeded')

  if (process.env.SEED_MUSIC_DATA !== 'true') {
    console.log('Dummy music dilewati. Set SEED_MUSIC_DATA=true untuk data demo music.')
    console.log('\n✅ Seed complete!')
    return
  }

  // ── Music Assets ──────────────────────────────────────────
  const musicAssets = [
    // Sound Scoring (3)
    {
      slug: 'epic-hero-theme',
      title: 'Epic Hero Theme',
      description: 'Grand orchestral hero theme with soaring brass, thundering percussion, and uplifting string melodies. Perfect for game trailers.',
      categorySlug: 'sound-scoring',
      accessLevel: 'FREE' as const,
      price: 0,
      durationMs: 145000,
      fileSize: 24650000,
      format: 'wav',
      tags: ['epic', 'cinematic', 'orchestra', 'brass'],
      bpm: 120,
      mood: 'epic',
      musicalKey: 'D',
      genres: ['orchestral', 'cinematic', 'trailer'],
    },
    {
      slug: 'suspense-thriller-score',
      title: 'Suspense Thriller Score',
      description: 'Dark suspenseful orchestral track with tense strings, subtle piano, and building percussion. Great for mystery and thriller content.',
      categorySlug: 'sound-scoring',
      accessLevel: 'PRO' as const,
      price: 0,
      durationMs: 198000,
      fileSize: 33660000,
      format: 'wav',
      tags: ['dark', 'cinematic', 'orchestra', 'reverb'],
      bpm: 85,
      mood: 'tense',
      musicalKey: 'Em',
      genres: ['cinematic', 'orchestral'],
    },
    {
      slug: 'emotional-piano-ballad',
      title: 'Emotional Piano Ballad',
      description: 'Heartfelt solo piano piece with gentle dynamics and emotional chord progressions. Ideal for documentary, drama, and emotional scenes.',
      categorySlug: 'sound-scoring',
      accessLevel: 'PURCHASE' as const,
      price: 45000,
      durationMs: 210000,
      fileSize: 35700000,
      format: 'wav',
      tags: ['cinematic', 'soft', 'reverb'],
      bpm: 72,
      mood: 'sad',
      musicalKey: 'C',
      genres: ['piano', 'cinematic'],
    },

    // Cinematic (3)
    {
      slug: 'cinematic-trailer-rise',
      title: 'Cinematic Trailer Rise',
      description: 'Powerful cinematic riser with massive sub drops, orchestral hits, and hybrid electronic elements. Designed for epic trailer edits.',
      categorySlug: 'cinematic',
      accessLevel: 'FREE' as const,
      price: 0,
      durationMs: 95000,
      fileSize: 16150000,
      format: 'wav',
      tags: ['cinematic', 'epic', 'impact', 'transition'],
      bpm: 140,
      mood: 'epic',
      musicalKey: 'G',
      genres: ['trailer', 'cinematic'],
    },
    {
      slug: 'dark-ambient-drone',
      title: 'Dark Ambient Drone',
      description: 'Eerie dark ambient drone with haunting textures and evolving atmospherics. Perfect for horror films, psychological thrillers, and dark games.',
      categorySlug: 'cinematic',
      accessLevel: 'PRO' as const,
      price: 0,
      durationMs: 320000,
      fileSize: 54400000,
      format: 'wav',
      tags: ['dark', 'ambient', 'horror', 'loop'],
      bpm: 60,
      mood: 'dark',
      musicalKey: 'Dm',
      genres: ['ambient', 'cinematic'],
    },
    {
      slug: 'victorious-fanfare',
      title: 'Victorious Fanfare',
      description: 'Triumphant brass fanfare with massive timpani rolls and full orchestra crescendo. Ideal for victory screens, award ceremonies, and celebrations.',
      categorySlug: 'cinematic',
      accessLevel: 'PURCHASE' as const,
      price: 55000,
      durationMs: 48000,
      fileSize: 8160000,
      format: 'wav',
      tags: ['epic', 'brass', 'orchestra', 'loud'],
      bpm: 130,
      mood: 'happy',
      musicalKey: 'Bb',
      genres: ['orchestral', 'cinematic', 'trailer'],
    },

    // Electronic Music (3)
    {
      slug: 'lofi-chill-beat',
      title: 'Lo-fi Chill Beat',
      description: 'Relaxing lo-fi hip hop beat with warm vinyl crackle, mellow keys, and laid-back drums. Perfect for study streams and chill content.',
      categorySlug: 'electronic-music',
      accessLevel: 'FREE' as const,
      price: 0,
      durationMs: 175000,
      fileSize: 29750000,
      format: 'wav',
      tags: ['electronic', 'soft', 'loop', 'drum'],
      bpm: 82,
      mood: 'calm',
      musicalKey: 'F',
      genres: ['lo-fi', 'hip-hop'],
    },
    {
      slug: 'cyberpunk-synth-wave',
      title: 'Cyberpunk Synthwave',
      description: 'Retro-futuristic synthwave track with pulsating arpeggios, heavy basslines, and neon-soaked atmosphere. Great for gaming and cyberpunk content.',
      categorySlug: 'electronic-music',
      accessLevel: 'PRO' as const,
      price: 0,
      durationMs: 230000,
      fileSize: 39100000,
      format: 'wav',
      tags: ['electronic', 'glitch', 'sci-fi', 'dark'],
      bpm: 118,
      mood: 'dark',
      musicalKey: 'Am',
      genres: ['electronic', 'edm'],
    },
    {
      slug: 'festival-drop-anthem',
      title: 'Festival Drop Anthem',
      description: 'High-energy festival EDM track with massive build-ups, crushing bass drops, and euphoric melodies. Designed for trailers and hype content.',
      categorySlug: 'electronic-music',
      accessLevel: 'PURCHASE' as const,
      price: 65000,
      durationMs: 265000,
      fileSize: 45050000,
      format: 'wav',
      tags: ['electronic', 'loud', 'drum', 'impact'],
      bpm: 150,
      mood: 'upbeat',
      musicalKey: 'E',
      genres: ['edm', 'electronic'],
    },
  ]

  for (const music of musicAssets) {
    const existing = await prisma.audioAsset.findUnique({ where: { slug: music.slug } })
    if (existing) {
      console.log(`  ⏭ Music "${music.title}" already exists, skipping`)
      continue
    }

    const asset = await prisma.audioAsset.create({
      data: {
        assetType: 'MUSIC',
        categoryId: catMap[music.categorySlug],
        authorId: admin.id,
        title: music.title,
        slug: music.slug,
        description: music.description,
        fileUrl: `/uploads/music/${music.slug}.wav`,
        previewUrl: `/uploads/music/preview/${music.slug}.mp3`,
        waveformData: fakeWaveform(),
        durationMs: music.durationMs,
        fileSize: music.fileSize,
        format: music.format,
        price: music.price,
        accessLevel: music.accessLevel,
        licenseType: music.accessLevel === 'PURCHASE' ? 'commercial' : music.accessLevel === 'PRO' ? 'commercial' : 'personal',
        bpm: music.bpm,
        mood: music.mood,
        musicalKey: music.musicalKey,
        isPublished: true,
        publishedAt: new Date(),
        reviewStatus: 'APPROVED',
        reviewedAt: new Date(),
        playCount: Math.floor(Math.random() * 1000),
        downloadCount: Math.floor(Math.random() * 400),
      },
    })

    // Connect tags
    for (const tagName of music.tags) {
      if (tagMap[tagName]) {
        await prisma.audioAssetOnTag.create({
          data: { audioAssetId: asset.id, tagId: tagMap[tagName] },
        })
      }
    }

    // Create Music metadata
    await prisma.musicMetadata.create({
      data: {
        assetId: asset.id,
        bpm: music.bpm,
        mood: music.mood,
        musicalKey: music.musicalKey,
      },
    })

    // Connect genres
    for (const genreName of music.genres) {
      const genreSlug = genreName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      if (genreMap[genreSlug]) {
        await prisma.audioAssetGenre.create({
          data: { assetId: asset.id, genreId: genreMap[genreSlug] },
        })
      }
    }

    console.log(`  ✓ Music "${music.title}" [${music.accessLevel}]`)
  }
  console.log('✓ Music assets seeded')

  console.log('\n✅ Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
