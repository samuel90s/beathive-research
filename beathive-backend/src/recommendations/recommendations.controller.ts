// src/recommendations/recommendations.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/**
 * Validates the behavior log payload.
 * Restricts action to known types to prevent arbitrary values entering
 * the weight table.
 */
class LogBehaviorDto {
  @IsString()
  @IsIn(
    ['search', 'click', 'play', 'play_long', 'wishlist', 'cart', 'download', 'purchase'],
    { message: 'action must be one of the allowed behavior types' },
  )
  action: string;

  @IsOptional()
  @IsUUID('4', { message: 'audioAssetId must be a valid UUID v4' })
  audioAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchQuery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  /**
   * GET /recommendations/me
   *
   * Hybrid personalized recommendations (CBF + CF + Bandit + MMR).
   * Falls back to time-decayed trending when user has < 20 interaction weight.
   *
   * Response includes:
   *  - items[]         : ranked RecommendedSound list with per-item reason
   *  - isColdStart     : true when trending fallback is active
   *  - tasteProfile    : user preference breakdown (categories, tags, moods, BPM, keys)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getPersonalized(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.service.getPersonalized(req.user.id, limit ? +limit : 10);
  }

  /**
   * GET /recommendations/similar/:audioId
   *
   * Content-based similar sounds for a given audio asset.
   * Uses BPM, key, duration, subcategory, and tag similarity.
   * No login required.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('similar/:audioId')
  async getSimilar(
    @Param('audioId') audioId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSimilar(audioId, limit ? +limit : 3);
  }

  /**
   * GET /recommendations/trending
   *
   * Time-decayed trending sounds using Hacker-News–style scoring:
   *   trendScore = (downloads × 2 + plays) / (ageHours + 2)^1.5
   *
   * Public endpoint — no login required.
   */
  @Get('trending')
  async getTrending(@Query('limit') limit?: string) {
    return this.service.getTrending(limit ? +limit : 10);
  }

  /**
   * GET /recommendations/session
   *
   * Session-aware real-time recommendations.
   * Blends the user's current session intent (40%) with their historical
   * preference vector (60%) to surface context-relevant sounds.
   *
   * Query params:
   *  - sessionId  : current session identifier (required)
   *  - limit      : number of results (default 10)
   */
  @UseGuards(JwtAuthGuard)
  @Get('session')
  async getSessionBased(
    @Request() req: any,
    @Query('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    if (!sessionId) return this.service.getTrending(limit ? +limit : 10);
    return this.service.getSessionBased(req.user.id, sessionId, limit ? +limit : 10);
  }

  /**
   * GET /recommendations/taste-profile
   *
   * User taste profile breakdown:
   *  - topCategories, topTags, topMoods, topSubcategories
   *  - avgBpm (weighted average of interacted sounds' BPM)
   *  - topKeys (preferred musical keys)
   *  - totalInteractions (total weighted signal mass)
   */
  @UseGuards(JwtAuthGuard)
  @Get('taste-profile')
  async getTasteProfile(@Request() req: any) {
    return this.service.getTasteProfile(req.user.id);
  }

  /**
   * GET /recommendations/evaluate
   *
   * Offline evaluation using 80/20 temporal train/test split on the user's
   * download history.
   *
   * Returns IR metrics:
   *  - meanPrecisionAtK, meanRecallAtK, meanNdcgAtK, meanFMeasure
   *  - mapAtK (Mean Average Precision)
   *  - intralistDiversity (ILD — diversity among the top-K results)
   *
   * Query params:
   *  - k : evaluation cut-off (default 10)
   */
  @UseGuards(JwtAuthGuard)
  @Get('evaluate')
  async evaluate(
    @Request() req: any,
    @Query('k') k?: string,
  ) {
    return this.service.evaluateForUser(req.user.id, k ? +k : 10);
  }

  /**
   * POST /recommendations/log
   *
   * Log user behavior from the frontend.
   * Triggers bandit conversion tracking for positive actions (play, wishlist, purchase).
   *
   * Valid actions: search | click | play | play_long | wishlist | cart | download | purchase
   */
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @Post('log')
  async logBehavior(@Request() req: any, @Body() dto: LogBehaviorDto) {
    await this.service.logBehavior(req.user.id, dto.action, {
      audioAssetId: dto.audioAssetId,
      searchQuery: dto.searchQuery,
      categorySlug: dto.categorySlug,
      sessionId: dto.sessionId,
    });
    return { ok: true };
  }
}
