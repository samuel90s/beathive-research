// src/recommendations/recommendations.module.ts
import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { EvaluationService } from './evaluation.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { BanditService } from './bandit.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    EvaluationService,
    CollaborativeFilteringService,
    BanditService,
    PrismaService,
  ],
  exports: [RecommendationsService, EvaluationService],
})
export class RecommendationsModule {}
