// src/subscriptions/subscriptions.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const midtransClient = require('midtrans-client');

@Injectable()
export class SubscriptionsService {
  private coreApi: any;
  private snap: any;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.coreApi = new midtransClient.CoreApi({
      isProduction: config.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: config.get('MIDTRANS_SERVER_KEY'),
    });
    this.snap = new midtransClient.Snap({
      isProduction: config.get('MIDTRANS_IS_PRODUCTION') === 'true',
      serverKey: config.get('MIDTRANS_SERVER_KEY'),
      clientKey: config.get('MIDTRANS_CLIENT_KEY'),
    });
  }

  // ─── Status subscription user ───────────────────────────

  async getMySubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    // Hitung sisa kuota download bulan ini (UTC agar konsisten lintas timezone)
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const downloadsThisMonth = await this.prisma.download.count({
      where: {
        userId,
        source: 'subscription',
        downloadedAt: { gte: thisMonth },
      },
    });

    return {
      ...sub,
      usage: {
        downloadsThisMonth,
        downloadLimit: sub.plan.downloadLimit,
        remaining: sub.plan.unlimited
          ? null
          : Math.max(0, sub.plan.downloadLimit - downloadsThisMonth),
        unlimited: sub.plan.unlimited,
      },
    };
  }

  // ─── Upgrade / ganti plan ───────────────────────────────

  async upgradePlan(
    userId: string,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (plan.slug === 'free') {
      throw new BadRequestException('Cannot upgrade to a free plan');
    }

    const basePrice =
      billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

    const SERVICE_FEE_PERCENT = 5;
    const TAX_PERCENT = 11;
    const serviceFee = Math.round(basePrice * SERVICE_FEE_PERCENT / 100);
    const tax = Math.round((basePrice + serviceFee) * TAX_PERCENT / 100);
    const totalAmount = basePrice + serviceFee + tax;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderId = `SUB-${ts}-${rnd}`;

    await this.prisma.subscriptionIntent.create({
      data: { orderId, userId, planSlug, billingCycle },
    });

    const transaction = await this.snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: totalAmount,
      },
      item_details: [
        {
          id: plan.id,
          price: basePrice,
          quantity: 1,
          name: `Plan ${plan.name} - ${billingCycle === 'yearly' ? 'Tahunan' : 'Bulanan'}`,
        },
        {
          id: 'service-fee',
          price: serviceFee,
          quantity: 1,
          name: `Biaya Layanan (${SERVICE_FEE_PERCENT}%)`,
        },
        {
          id: 'ppn',
          price: tax,
          quantity: 1,
          name: `PPN (${TAX_PERCENT}%)`,
        },
      ],
      customer_details: {
        first_name: user.name,
        email: user.email,
      },
    });

    return {
      snapToken: transaction.token,
      orderId,
      plan: plan.name,
      price: totalAmount,
      billingCycle,
    };
  }

  // ─── Aktifkan subscription setelah bayar ────────────────
  // Dipanggil dari WebhookService setelah konfirmasi Midtrans

  async activateSubscription(
    userId: string,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
    gatewaySubId: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException(`Plan '${planSlug}' not found`);

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
        gatewaySubId,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
        gatewaySubId,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  // ─── Verify payment & aktifkan subscription ─────────────
  // Dipanggil frontend di onSuccess Snap sebagai backup dari webhook

  async verifyAndActivate(userId: string, orderId: string) {
    // Cari intent
    const intent = await this.prisma.subscriptionIntent.findUnique({
      where: { orderId },
    });

    if (!intent) {
      // Mungkin sudah diproses webhook duluan — cek subscription aktif
      const sub = await this.prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
      if (sub?.status === 'ACTIVE') return { activated: true, alreadyActive: true };
      throw new BadRequestException('Payment intent not found');
    }

    if (intent.userId !== userId) {
      throw new BadRequestException('Order does not belong to this user');
    }

    // Cek status transaksi langsung ke Midtrans
    let midtransStatus: string;
    try {
      const result = await this.coreApi.transaction.status(orderId);
      midtransStatus = result.transaction_status;
    } catch {
      throw new BadRequestException('Gagal verifikasi status pembayaran ke Midtrans');
    }

    const isPaid = midtransStatus === 'settlement' || midtransStatus === 'capture';
    if (!isPaid) {
      throw new BadRequestException(`Payment not yet complete (status: ${midtransStatus})`);
    }

    // Aktifkan subscription
    await this.activateSubscription(
      intent.userId,
      intent.planSlug,
      intent.billingCycle as 'monthly' | 'yearly',
      orderId,
    );

    // Hapus intent
    await this.prisma.subscriptionIntent.delete({ where: { orderId } });

    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    return { activated: true, subscription: sub };
  }

  // ─── Cancel subscription ────────────────────────────────

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub || sub.status !== 'ACTIVE') {
      throw new BadRequestException('No active subscription found');
    }

    if (sub.plan.slug === 'free') {
      throw new BadRequestException('Free plan cannot be cancelled');
    }

    // Set cancelled — akses tetap aktif sampai currentPeriodEnd
    await this.prisma.subscription.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return {
      message: 'Subscription berhasil di-cancel',
      accessUntil: sub.currentPeriodEnd,
    };
  }
}
