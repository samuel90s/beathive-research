// src/subscriptions/subscriptions.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const midtransClient = require('midtrans-client');

const MIDTRANS_TIMEOUT_MS = 15_000;

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

  // Status subscription user

  async getMySubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    // Hitung sisa kuota download HARI ini (UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const downloadsToday = await this.prisma.download.count({
      where: {
        userId,
        source: 'subscription',
        downloadedAt: { gte: todayStart },
      },
    });

    return {
      ...sub,
      usage: {
        downloadsThisMonth: downloadsToday,  // kept key for backward compat with frontend
        downloadLimit: sub.plan.downloadLimit,
        remaining: sub.plan.unlimited
          ? null
          : Math.max(0, sub.plan.downloadLimit - downloadsToday),
        unlimited: sub.plan.unlimited,
      },
    };
  }

  // Upgrade / ganti plan

  async upgradePlan(
    userId: string,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly' | '1month' | '3months' | '6months' | '12months',
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (plan.slug === 'free') {
      throw new BadRequestException('Cannot upgrade to a free plan');
    }

    // Map duration to price
    const PRICE_MAP: Record<string, number> = {
      'monthly':  plan.priceMonthly,
      '1month':   plan.priceMonthly,
      '3months':  Math.round(plan.priceMonthly * 3 * 0.87),  // ~13% hemat
      '6months':  Math.round(plan.priceMonthly * 6 * 0.80),  // ~20% hemat
      '12months': Math.round(plan.priceMonthly * 12 * 0.73), // ~27% hemat
      'yearly':   plan.priceYearly || Math.round(plan.priceMonthly * 12 * 0.73),
    };

    const basePrice = PRICE_MAP[billingCycle] ?? plan.priceMonthly;

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

    let transaction: { token: string };
    try {
      transaction = await this.createSnapTransactionWithTimeout({
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
        callbacks: {
          finish: `${this.config.get('FRONTEND_URL')}/studio?upgrade=success`,
        },
      });
    } catch (err: any) {
      await this.prisma.subscriptionIntent.deleteMany({ where: { orderId } });
      if (err?.getStatus?.() === 504) throw err;
      throw new BadGatewayException(
        err?.message || 'Gagal membuat sesi pembayaran Midtrans. Coba lagi sebentar.',
      );
    }

    return {
      snapToken: transaction.token,
      orderId,
      plan: plan.name,
      price: totalAmount,
      billingCycle,
    };
  }

  // Aktifkan subscription setelah bayar
  // Dipanggil dari WebhookService setelah konfirmasi Midtrans

  private async createSnapTransactionWithTimeout(params: Record<string, unknown>): Promise<{ token: string }> {
    return Promise.race([
      this.snap.createTransaction(params),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new GatewayTimeoutException('Midtrans terlalu lama merespons. Coba lagi sebentar.'));
        }, MIDTRANS_TIMEOUT_MS);
      }),
    ]);
  }

  async activateSubscription(
    userId: string,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly' | '1month' | '3months' | '6months' | '12months',
    gatewaySubId: string,
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException(`Plan '${planSlug}' not found`);

    const now = new Date();
    const periodEnd = new Date(now);

    // Map billing cycle to months
    const MONTHS_MAP: Record<string, number> = {
      'monthly':  1,
      '1month':   1,
      '3months':  3,
      '6months':  6,
      '12months': 12,
      'yearly':   12,
    };
    const months = MONTHS_MAP[billingCycle] ?? 1;
    periodEnd.setMonth(periodEnd.getMonth() + months);

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

  // Verify payment & aktifkan subscription
  // Dipanggil frontend di onSuccess Snap sebagai backup dari webhook

  async verifyAndActivate(userId: string, orderId: string) {
    // Cari intent
    const intent = await this.prisma.subscriptionIntent.findUnique({
      where: { orderId },
    });

    if (!intent) {
      // Mungkin sudah diproses webhook duluan, cek subscription aktif
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

  // Downgrade / ganti plan

  async changePlan(userId: string, planSlug: string, billingCycle: 'monthly' | 'yearly') {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (planSlug === 'free') return this.cancelSubscription(userId);

    await this.prisma.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        billingCycle: billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
        status: 'ACTIVE',
      },
    });
    return { message: `Plan berhasil diubah ke ${plan.name}`, plan: plan.name };
  }

  // Cancel subscription

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

    // Set cancelled; akses tetap aktif sampai currentPeriodEnd
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

