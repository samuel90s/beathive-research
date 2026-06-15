// src/admin/admin.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsEmail, IsString, IsOptional, IsIn, MaxLength, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class RejectSoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class UpdateWithdrawalDto {
  @IsString()
  @IsIn(['PAID', 'REJECTED'])
  status: 'PAID' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @IsString()
  planSlug?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @IsString()
  planSlug?: string;
}

class CategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug: string;

  @IsIn(['sfx', 'music'])
  type: 'sfx' | 'music';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  icon?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // GET /admin/stats
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // GET /admin/sounds?status=PENDING&page=1&limit=20
  @Get('sounds')
  async getSounds(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.adminService.getSounds(status, p, l);
  }

  // PATCH /admin/sounds/:id/approve
  @Patch('sounds/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveSound(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.adminService.approveSound(id, userId);
  }

  // PATCH /admin/sounds/:id/reject
  @Patch('sounds/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectSound(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() body: RejectSoundDto,
  ) {
    return this.adminService.rejectSound(id, userId, body.reason || 'Does not meet quality standards');
  }

  // GET /admin/users?search=&page=1&limit=20
  @Get('users')
  async getUsers(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.adminService.getUsers(p, l, search);
  }

  @Get('plans')
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Post('users')
  async createUser(@Body() body: CreateUserDto) {
    return this.adminService.createUser(body);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @CurrentUser() adminId: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, adminId, body);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() adminId: string,
  ) {
    return this.adminService.deleteUser(id, adminId);
  }

  // GET /admin/withdrawals?status=PENDING&page=1&limit=20
  @Get('withdrawals')
  async getWithdrawals(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.adminService.getWithdrawals(status, p, l);
  }

  // PATCH /admin/withdrawals/:id
  @Patch('withdrawals/:id')
  @HttpCode(HttpStatus.OK)
  async updateWithdrawal(
    @Param('id') id: string,
    @Body() body: UpdateWithdrawalDto,
  ) {
    return this.adminService.updateWithdrawalStatus(id, body.status, body.note);
  }

  // GET /admin/orders?page=1&limit=20
  @Get('orders')
  async getOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.adminService.getOrders(p, l);
  }

  // ─── Categories ──────────────────────────────────────────

  @Get('categories')
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  async createCategory(@Body() body: CategoryDto) {
    return this.adminService.createCategory(body.name, body.slug, body.type, body.icon);
  }

  @Patch('categories/:id')
  @HttpCode(HttpStatus.OK)
  async updateCategory(@Param('id') id: string, @Body() body: CategoryDto) {
    return this.adminService.updateCategory(id, body.name, body.slug, body.type, body.icon);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ─── Tags ────────────────────────────────────────────────

  @Get('tags')
  async getTags() {
    return this.adminService.getTags();
  }

  @Post('tags')
  async createTag(@Body() body: { name: string; slug: string }) {
    return this.adminService.createTag(body.name, body.slug);
  }

  @Delete('tags/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTag(@Param('id') id: string) {
    return this.adminService.deleteTag(id);
  }
}
