// src/common/guards/subscription.guard.ts
// Guard untuk cek apakah user punya subscription aktif
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.get<string>(
      'required_plan',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) return false;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new ForbiddenException('An active subscription is required');
    }

    // Cek level plan jika diperlukan
    if (requiredPlan) {
      const planHierarchy = ['free', 'pro', 'business'];
      const userPlanLevel = planHierarchy.indexOf(subscription.plan.slug);
      const requiredLevel = planHierarchy.indexOf(requiredPlan);

      if (userPlanLevel < requiredLevel) {
        throw new ForbiddenException(
          `Fitur ini butuh plan ${requiredPlan} ke atas`,
        );
      }
    }

    // Attach subscription info ke request untuk dipakai di controller
    request.subscription = subscription;
    return true;
  }
}
