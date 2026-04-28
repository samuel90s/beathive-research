// src/orders/orders.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Res,
  UseGuards,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { OrdersService, CreateOrderDto } from './orders.service';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private webhookService: WebhookService,
    private config: ConfigService,
  ) {}

  // POST /orders  — buat order baru
  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(userId, dto);
  }

  // GET /orders/me  — riwayat order user
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@CurrentUser() userId: string) {
    return this.ordersService.getMyOrders(userId);
  }

  // POST /orders/verify-payment  — frontend panggil di onSuccess snap
  @Post('verify-payment')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @CurrentUser() userId: string,
    @Body() body: { orderId: string },
  ) {
    return this.ordersService.verifyAndActivateOrder(userId, body.orderId);
  }

  // POST /orders/webhook/midtrans  — callback dari Midtrans
  // Endpoint ini TIDAK pakai JWT — Midtrans yang panggil
  // Verifikasi dilakukan via signature di WebhookService
  @Post('webhook/midtrans')
  @HttpCode(HttpStatus.OK)
  async midtransWebhook(@Body() payload: any) {
    return this.webhookService.handleMidtransWebhook(payload);
  }

  // GET /orders/:id/invoice  — detail invoice
  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  async getInvoice(
    @CurrentUser() userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getInvoice(userId, orderId);
  }

  // GET /orders/:id/invoice/pdf  — download PDF invoice
  @Get(':id/invoice/pdf')
  @UseGuards(JwtAuthGuard)
  async downloadInvoicePdf(
    @CurrentUser() userId: string,
    @Param('id') orderId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.ordersService.getInvoice(userId, orderId);
    const pdf = await this.ordersService.downloadInvoicePdf(userId, orderId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  // PATCH /orders/:id/cancel  — batalkan order PENDING
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @CurrentUser() userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.cancelOrder(userId, orderId);
  }

  // GET /orders/:id/snap-token  — ambil snap token untuk lanjut bayar
  @Get(':id/snap-token')
  @UseGuards(JwtAuthGuard)
  async getSnapToken(
    @CurrentUser() userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getSnapToken(userId, orderId);
  }

  // ─── DEV ONLY: Simulate payment success ──────────────────
  // POST /orders/dev/simulate-payment
  // Body: { orderId: "SUB-xxx-xxx" } or { orderId: "regular-order-id" }
  // Triple protection: NODE_ENV check + JWT required + ADMIN role only
  @Post('dev/simulate-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async devSimulatePayment(@Body() body: { orderId: string }) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('This endpoint is not available in production');
    }
    return this.webhookService.devSimulatePayment(body.orderId);
  }
}
