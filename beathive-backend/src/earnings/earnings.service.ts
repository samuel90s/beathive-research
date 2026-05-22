// src/earnings/earnings.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  CREATOR_POOL_PERCENT,
  CREATOR_PURCHASE_PERCENT,
  MIN_WITHDRAWAL_RP,
  SUBSCRIPTION_FALLBACK_PRICE_RP,
} from '../config/constants';

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── Hitung & simpan earning setelah PRO download ────────
  // Dipanggil fire-and-forget dari requestDownload

  async recordEarning(soundId: string, downloadId: string) {
    try {
      const sound = await this.prisma.soundEffect.findUnique({
        where: { id: soundId },
        select: { authorId: true, accessLevel: true, title: true },
      });

      if (!sound?.authorId) return;

      let amountRp = 0;
      let earningKey = downloadId;

      if (sound.accessLevel === 'PURCHASE') {
        // PURCHASE earnings are recorded by recordOrderEarnings() on order payment — skip here
        return;
      } else if (sound.accessLevel === 'PRO') {
        // PRO subscription download: pool-based
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const download = await this.prisma.download.findUnique({ where: { id: downloadId }, select: { userId: true, source: true } });
        if (!download?.userId) return;

        // Purchase downloads are already paid via recordOrderEarnings — skip double-counting
        if (download.source === 'purchase') return;

        // Use predictable dedup key — prevents race condition between concurrent requests
        const yearMonth = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`;
        const dedupKey = `pro:${download.userId}:${soundId}:${yearMonth}`;
        earningKey = dedupKey;

        const priorEarning = await this.prisma.creatorEarning.findFirst({ where: { downloadId: dedupKey } });
        if (priorEarning) return;

        const subRevenue = await this.prisma.order.aggregate({
          where: {
            status: 'PAID',
            createdAt: { gte: startOfMonth },
            gatewayOrderId: { startsWith: 'SUB-' },
          },
          _sum: { totalAmount: true },
        });

        let monthlyRevenue = subRevenue._sum.totalAmount ?? 0;
        if (monthlyRevenue === 0) {
          const activeSubs = await this.prisma.subscription.count({
            where: { status: 'ACTIVE', plan: { slug: { not: 'free' } } },
          });
          monthlyRevenue = activeSubs * SUBSCRIPTION_FALLBACK_PRICE_RP;
        }

        const totalDownloads = await this.prisma.download.count({
          where: {
            downloadedAt: { gte: startOfMonth },
            soundEffect: { accessLevel: 'PRO' },
          },
        });

        if (totalDownloads === 0) return;

        const pool = Math.round(monthlyRevenue * (CREATOR_POOL_PERCENT / 100));
        amountRp = Math.round(pool / totalDownloads);
      } else {
        return; // FREE sounds don't generate earnings
      }

      if (amountRp <= 0) return;

      const wallet = await this.prisma.creatorWallet.upsert({
        where: { userId: sound.authorId },
        update: {},
        create: { userId: sound.authorId, balance: 0, totalEarned: 0 },
      });

      try {
        await this.prisma.$transaction([
          this.prisma.creatorEarning.create({
            data: {
              walletId: wallet.id,
              soundId,
              downloadId: earningKey,
              amountRp,
              poolPercent: (sound.accessLevel as any) === 'PURCHASE' ? CREATOR_PURCHASE_PERCENT : CREATOR_POOL_PERCENT,
            },
          }),
          this.prisma.creatorWallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: amountRp },
              totalEarned: { increment: amountRp },
            },
          }),
        ]);
      } catch (err: any) {
        if (err.code === 'P2002') return; // duplicate earning — concurrent request won the race
        throw err;
      }

      this.logger.log(
        `Earning recorded: creator=${sound.authorId} sound="${sound.title}" amount=Rp${amountRp.toLocaleString()} type=${sound.accessLevel}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to record earning: ${err.message}`);
    }
  }

  // ─── Record earnings when a PURCHASE order is paid ───────
  // Uses downloadId = 'order:<itemId>' as dedup key — safe to call multiple times

  async recordOrderEarnings(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              soundEffect: { select: { id: true, authorId: true, accessLevel: true, title: true } },
            },
          },
        },
      });

      if (!order || order.status !== 'PAID') return;

      for (const item of order.items) {
        if (!item.soundEffect.authorId) continue;

        const dedupKey = `order:${item.id}`;

        // Idempotent — skip if already recorded
        const existing = await this.prisma.creatorEarning.findFirst({
          where: { downloadId: dedupKey },
        });
        if (existing) continue;

        const amountRp = Math.round(item.priceSnapshot * (CREATOR_PURCHASE_PERCENT / 100));
        if (amountRp <= 0) continue;

        const wallet = await this.prisma.creatorWallet.upsert({
          where: { userId: item.soundEffect.authorId },
          update: {},
          create: { userId: item.soundEffect.authorId, balance: 0, totalEarned: 0 },
        });

        await this.prisma.$transaction([
          this.prisma.creatorEarning.create({
            data: {
              walletId: wallet.id,
              soundId: item.soundEffectId,
              downloadId: dedupKey,
              amountRp,
              poolPercent: CREATOR_PURCHASE_PERCENT,
            },
          }),
          this.prisma.creatorWallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: amountRp },
              totalEarned: { increment: amountRp },
            },
          }),
        ]);

        this.logger.log(
          `Purchase earning recorded: creator=${item.soundEffect.authorId} sound="${item.soundEffect.title}" amount=Rp${amountRp.toLocaleString()}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to record order earnings: ${err.message}`);
    }
  }

  // ─── Creator analytics ───────────────────────────────────

  async getAnalytics(userId: string, monthsBack = 12) {
    const wallet = await this.prisma.creatorWallet.findUnique({ where: { userId } });
    if (!wallet) return { monthlyEarnings: [], topSounds: [], totalThisMonth: 0, totalLastMonth: 0, trend: 'flat' };

    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);

    const earnings = await this.prisma.creatorEarning.findMany({
      where: { walletId: wallet.id, earnedAt: { gte: since } },
      select: { amountRp: true, soundId: true, earnedAt: true },
      orderBy: { earnedAt: 'asc' },
    });

    // Group by YYYY-MM
    const monthMap: Record<string, { totalRp: number; count: number }> = {};
    for (const e of earnings) {
      const key = `${e.earnedAt.getFullYear()}-${String(e.earnedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { totalRp: 0, count: 0 };
      monthMap[key].totalRp += e.amountRp;
      monthMap[key].count += 1;
    }

    // Fill in empty months
    const monthlyEarnings = [];
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyEarnings.push({ month: key, totalRp: monthMap[key]?.totalRp ?? 0, downloadCount: monthMap[key]?.count ?? 0 });
    }

    // Top sounds by earnings
    const soundTotals: Record<string, number> = {};
    for (const e of earnings) soundTotals[e.soundId] = (soundTotals[e.soundId] ?? 0) + e.amountRp;
    const topSoundIds = Object.entries(soundTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const topSoundData = await this.prisma.soundEffect.findMany({
      where: { id: { in: topSoundIds } },
      select: { id: true, title: true, downloadCount: true, slug: true },
    });
    const topSounds = topSoundIds.map(id => {
      const s = topSoundData.find(x => x.id === id);
      return { soundId: id, title: s?.title ?? '—', slug: s?.slug ?? '', earnings: soundTotals[id], downloads: s?.downloadCount ?? 0 };
    });

    // Trend: compare this month vs last month
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const totalThisMonth = monthMap[thisMonthKey]?.totalRp ?? 0;
    const totalLastMonth = monthMap[lastMonthKey]?.totalRp ?? 0;
    const trend = totalThisMonth > totalLastMonth ? 'up' : totalThisMonth < totalLastMonth ? 'down' : 'flat';

    return { monthlyEarnings, topSounds, totalThisMonth, totalLastMonth, trend };
  }

  // ─── Get wallet + earning history ────────────────────────

  async getWallet(userId: string, earningsPage = 1, earningsLimit = 20) {
    const skip = (Math.max(1, earningsPage) - 1) * earningsLimit;

    const wallet = await this.prisma.creatorWallet.findUnique({
      where: { userId },
      include: {
        earnings: {
          orderBy: { earnedAt: 'desc' },
          skip,
          take: earningsLimit,
          select: {
            id: true,
            soundId: true,
            amountRp: true,
            earnedAt: true,
          },
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!wallet) {
      return { balance: 0, totalEarned: 0, earnings: [], withdrawals: [], earningsPagination: { total: 0, page: earningsPage, limit: earningsLimit, totalPages: 0 } };
    }

    // Total earnings count untuk pagination
    const totalEarnings = await this.prisma.creatorEarning.count({ where: { walletId: wallet.id } });

    // Enrich earnings dengan sound title
    const soundIds = [...new Set(wallet.earnings.map(e => e.soundId))];
    const sounds = await this.prisma.soundEffect.findMany({
      where: { id: { in: soundIds } },
      select: { id: true, title: true },
    });
    const soundMap = Object.fromEntries(sounds.map(s => [s.id, s.title]));

    return {
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      earnings: wallet.earnings.map(e => ({
        id: e.id,
        soundTitle: soundMap[e.soundId] ?? 'Unknown sound',
        amountRp: e.amountRp,
        earnedAt: e.earnedAt,
      })),
      withdrawals: wallet.withdrawals,
      earningsPagination: {
        total: totalEarnings,
        page: earningsPage,
        limit: earningsLimit,
        totalPages: Math.ceil(totalEarnings / earningsLimit),
      },
    };
  }

  // ─── Request withdrawal ───────────────────────────────────

  async requestWithdrawal(userId: string, amountRp: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bankName: true, bankAccount: true, bankAccountName: true, email: true, name: true },
    });

    if (!user?.bankName || !user?.bankAccount || !user?.bankAccountName) {
      throw new Error('Please complete your bank account details (bank, account number, and account holder name) in Profile Settings first.');
    }

    if (amountRp < MIN_WITHDRAWAL_RP) {
      throw new Error(`Minimum withdrawal is Rp ${MIN_WITHDRAWAL_RP.toLocaleString('id-ID')}`);
    }

    // Fetch wallet AND decrement inside interactive transaction to prevent double-spend race condition
    let withdrawal: any;
    try {
      withdrawal = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.creatorWallet.findUnique({ where: { userId } });

        if (!wallet || wallet.balance < MIN_WITHDRAWAL_RP) {
          throw new Error(`Minimum balance to withdraw is Rp ${MIN_WITHDRAWAL_RP.toLocaleString('id-ID')}`);
        }
        if (wallet.balance < amountRp) {
          throw new Error('Amount exceeds available balance');
        }

        const newWithdrawal = await tx.withdrawalRequest.create({
          data: {
            walletId: wallet.id,
            amountRp,
            bankName: user.bankName!,
            accountNo: user.bankAccount!,
            note: `Account holder: ${user.bankAccountName}`,
            status: 'PENDING',
          },
        });

        await tx.creatorWallet.update({
          where: { id: wallet.id, balance: { gte: amountRp } },
          data: { balance: { decrement: amountRp } },
        });

        return newWithdrawal;
      });
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new Error('Insufficient balance — please refresh and try again');
      }
      throw err;
    }

    // Notify creator via email (fire-and-forget)
    this.email.sendWithdrawalRequested(user.email!, amountRp, user.bankName!, user.bankAccount!, user.name ?? undefined)
      .catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));

    return withdrawal;
  }
}
