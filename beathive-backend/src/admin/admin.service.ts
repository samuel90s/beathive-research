// src/admin/admin.service.ts
import {
  Injectable, NotFoundException, ForbiddenException, Logger,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── Dashboard stats ─────────────────────────────────────

  async getStats() {
    const [users, sounds, pendingSounds, orders, activeSubscriptions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.audioAsset.count(),
        this.prisma.audioAsset.count({ where: { reviewStatus: { in: ['PENDING', 'NEEDS_RE_REVIEW'] } } }),
        this.prisma.order.count({ where: { status: 'PAID' } }),
        this.prisma.subscription.count({
          where: { status: 'ACTIVE', plan: { slug: { not: 'free' } } },
        }),
      ]);

    const revenueAgg = await this.prisma.order.aggregate({
      where: { status: 'PAID' },
      _sum: { totalAmount: true },
    });

    return {
      users,
      sounds,
      pendingSounds,
      orders,
      activeSubscriptions,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    };
  }

  // ─── List sounds (semua, dengan filter status) ───────────

  async getSounds(status?: string, page = 1, limit = 20) {
    const where: any = {};
    if (status) where.reviewStatus = status;

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.audioAsset.count({ where }),
      this.prisma.audioAsset.findMany({
        where,
        include: {
          category: true,
          author: { select: { id: true, name: true, email: true, createdAt: true, _count: { select: { uploadedAssets: true } } } },
          tags: { include: { tag: { select: { name: true, slug: true } } } },
          _count: { select: { downloads: true, ratings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Approve sound ───────────────────────────────────────

  async approveSound(soundId: string, adminId: string) {
    const sound = await this.prisma.audioAsset.findUnique({ where: { id: soundId } });
    if (!sound) throw new NotFoundException('Sound not found');

    const updated = await this.prisma.audioAsset.update({
      where: { id: soundId },
      data: {
        reviewStatus: 'APPROVED',
        reviewNote: null,
        reviewedAt: new Date(),
        reviewedById: adminId,
        isPublished: true,
        publishedAt: sound.publishedAt ?? new Date(),
      },
    });

    // Notify creator via email (fire-and-forget)
    if (sound.authorId) {
      this.prisma.user.findUnique({ where: { id: sound.authorId }, select: { email: true, name: true } })
        .then(author => {
          if (author) this.email.sendSoundReviewNotification(author.email, sound.title, 'APPROVED', undefined, author.name).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
        }).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
    }

    return updated;
  }

  // ─── Reject sound ────────────────────────────────────────

  async rejectSound(soundId: string, adminId: string, reason: string) {
    const sound = await this.prisma.audioAsset.findUnique({ where: { id: soundId } });
    if (!sound) throw new NotFoundException('Sound not found');

    const updated = await this.prisma.audioAsset.update({
      where: { id: soundId },
      data: {
        reviewStatus: 'REJECTED',
        reviewNote: reason,
        reviewedAt: new Date(),
        reviewedById: adminId,
        isPublished: false,
      },
    });

    // Notify creator via email (fire-and-forget)
    if (sound.authorId) {
      this.prisma.user.findUnique({ where: { id: sound.authorId }, select: { email: true, name: true } })
        .then(author => {
          if (author) this.email.sendSoundReviewNotification(author.email, sound.title, 'REJECTED', reason, author.name).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
        }).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
    }

    return updated;
  }

  // ─── List users ──────────────────────────────────────────

  async getUsers(page = 1, limit = 20, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          subscription: { include: { plan: true } },
          _count: { select: { uploadedAssets: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPlans() {
    return this.prisma.plan.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async createUser(dto: {
    name: string;
    email: string;
    password: string;
    role?: 'USER' | 'ADMIN';
    planSlug?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email is already registered');

    const plan = await this.prisma.plan.findUnique({
      where: { slug: dto.planSlug || 'free' },
    });
    if (!plan) throw new BadRequestException('Plan not found');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          provider: 'email',
          role: dto.role || 'USER',
          emailVerified: true,
        },
      });
      await tx.subscription.create({
        data: {
          userId: created.id,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          currentPeriodEnd: plan.slug === 'free'
            ? new Date('2099-12-31T23:59:59.000Z')
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return created;
    });

    return { id: user.id, message: 'User created successfully' };
  }

  async updateUser(
    userId: string,
    adminId: string,
    dto: {
      name?: string;
      email?: string;
      password?: string;
      role?: 'USER' | 'ADMIN';
      planSlug?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (userId === adminId && dto.role && dto.role !== 'ADMIN') {
      throw new ForbiddenException('You cannot remove your own admin role');
    }

    if (dto.email && dto.email !== user.email) {
      const duplicate = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (duplicate) throw new ConflictException('Email is already registered');
    }

    if (user.role === 'ADMIN' && dto.role === 'USER') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) throw new ForbiddenException('At least one admin must remain');
    }

    const plan = dto.planSlug
      ? await this.prisma.plan.findUnique({ where: { slug: dto.planSlug } })
      : null;
    if (dto.planSlug && !plan) throw new BadRequestException('Plan not found');

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          email: dto.email,
          role: dto.role,
          passwordHash,
          refreshTokenHash: dto.password ? null : undefined,
          refreshTokenUpdatedAt: dto.password ? null : undefined,
        },
      });

      if (plan) {
        await tx.subscription.upsert({
          where: { userId },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            cancelledAt: null,
            currentPeriodEnd: plan.slug === 'free'
              ? new Date('2099-12-31T23:59:59.000Z')
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          create: {
            userId,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            currentPeriodEnd: plan.slug === 'free'
              ? new Date('2099-12-31T23:59:59.000Z')
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    });

    return { ok: true, message: 'User updated successfully' };
  }

  async deleteUser(userId: string, adminId: string) {
    if (userId === adminId) throw new ForbiddenException('You cannot delete your own account');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            uploadedAssets: true,
            orders: true,
            downloads: true,
            ratings: true,
            wishlists: true,
          },
        },
        wallet: {
          select: {
            _count: { select: { earnings: true, withdrawals: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const activityCount =
      user._count.uploadedAssets +
      user._count.orders +
      user._count.downloads +
      user._count.ratings +
      user._count.wishlists +
      (user.wallet?._count.earnings || 0) +
      (user.wallet?._count.withdrawals || 0);
    if (activityCount > 0) {
      throw new ForbiddenException(
        'User has sounds, orders, downloads, or financial history and cannot be permanently deleted',
      );
    }

    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) throw new ForbiddenException('At least one admin must remain');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionIntent.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      if (user.wallet) await tx.creatorWallet.delete({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { ok: true, message: 'User deleted successfully' };
  }

  // ─── List withdrawal requests ─────────────────────────────

  async getWithdrawals(status?: string, page = 1, limit = 20) {
    const where: any = {};
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.withdrawalRequest.count({ where }),
      this.prisma.withdrawalRequest.findMany({
        where,
        include: {
          wallet: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateWithdrawalStatus(id: string, status: 'PAID' | 'REJECTED', note?: string) {
    const req = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Withdrawal request not found');

    if (req.status !== 'PENDING') {
      throw new ForbiddenException('Only PENDING withdrawals can be updated');
    }

    if (status === 'REJECTED') {
      // Refund the balance
      await this.prisma.$transaction([
        this.prisma.withdrawalRequest.update({
          where: { id },
          data: { status, note: note ?? null },
        }),
        this.prisma.creatorWallet.update({
          where: { id: req.walletId },
          data: { balance: { increment: req.amountRp } },
        }),
      ]);
    } else {
      await this.prisma.withdrawalRequest.update({
        where: { id },
        data: { status, note: note ?? null },
      });
    }

    // Notify creator via email (fire-and-forget)
    this.prisma.creatorWallet.findUnique({
      where: { id: req.walletId },
      include: { user: { select: { email: true, name: true } } },
    }).then(wallet => {
      if (!wallet?.user) return;
      const { email, name } = wallet.user;
      if (status === 'PAID') {
        this.email.sendWithdrawalApproved(email, req.amountRp, { bankName: req.bankName ?? '', accountNo: req.accountNo ?? '' }, name ?? undefined).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
      } else {
        this.email.sendWithdrawalRejected(email, req.amountRp, note ?? 'No reason provided', name ?? undefined).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));
      }
    }).catch((err: any) => this.logger.error(`Email notification failed: ${err?.message}`));

    return { ok: true };
  }

  // ─── List orders ─────────────────────────────────────────

  async getOrders(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { audioAsset: { select: { title: true } } } },
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Categories ──────────────────────────────────────────

  async getCategories() {
    const cats = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { audioAssets: true } } },
    });
    return cats;
  }

  async createCategory(name: string, slug: string, type: 'sfx' | 'music', icon?: string) {
    return this.prisma.category.create({ data: { name, slug, type, icon } });
  }

  async updateCategory(id: string, name: string, slug: string, type: 'sfx' | 'music', icon?: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { audioAssets: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat.type !== type && cat._count.audioAssets > 0) {
      throw new ForbiddenException(
        `Cannot change type: ${cat._count.audioAssets} audio assets use this category`,
      );
    }
    return this.prisma.category.update({ where: { id }, data: { name, slug, type, icon } });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { audioAssets: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat._count.audioAssets > 0) throw new ForbiddenException(`Cannot delete: ${cat._count.audioAssets} sounds use this category`);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Tags ────────────────────────────────────────────────

  async getTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { audioAssets: true } } },
    });
  }

  async createTag(name: string, slug: string) {
    return this.prisma.tag.create({ data: { name, slug } });
  }

  async deleteTag(id: string) {
    await this.prisma.audioAssetOnTag.deleteMany({ where: { tagId: id } });
    await this.prisma.tag.delete({ where: { id } });
    return { ok: true };
  }
}
