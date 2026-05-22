import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly emailFrom: string;

  constructor(private config: ConfigService) {
    const mailgunKey = this.config.get<string>('MAILGUN_API_KEY');
    const mailgunDomain = this.config.get<string>('MAILGUN_DOMAIN');
    this.emailFrom = this.config.get<string>('EMAIL_FROM', 'noreply@beathive.com');

    // Mailgun SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
      auth: {
        user: `postmaster@${mailgunDomain}`,
        pass: mailgunKey,
      },
    });

    this.logger.log(`Email service initialized with domain: ${mailgunDomain}`);
  }

  async sendPasswordReset(email: string, resetUrl: string, userName: string = 'User') {
    try {
      const html = this.getPasswordResetTemplate(resetUrl, userName);
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Reset Your BeatHive Password',
        html,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendWithdrawalApproved(email: string, amount: number, bankDetails: { bankName: string; accountNo: string }, userName: string = 'Creator') {
    try {
      const html = this.getWithdrawalApprovedTemplate(amount, bankDetails, userName);
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Your Withdrawal Has Been Approved',
        html,
      });
      this.logger.log(`Withdrawal approved email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send withdrawal email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendWithdrawalRejected(email: string, amount: number, reason: string, userName: string = 'Creator') {
    try {
      const html = this.getWithdrawalRejectedTemplate(amount, reason, userName);
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Your Withdrawal Request Was Rejected',
        html,
      });
      this.logger.log(`Withdrawal rejected email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send withdrawal rejection email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendPaymentConfirmed(email: string, orderId: string, totalAmount: number, userName: string = 'User') {
    try {
      const html = this.getPaymentConfirmedTemplate(orderId, totalAmount, userName);
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject: 'Payment Confirmed - Your Order',
        html,
      });
      this.logger.log(`Payment confirmation email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send payment confirmation email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendSoundReviewNotification(email: string, soundTitle: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string, userName: string = 'Creator') {
    try {
      const html = this.getSoundReviewTemplate(soundTitle, status, reviewNote, userName);
      const subject = status === 'APPROVED' ? `Your Sound "${soundTitle}" Was Approved` : `Your Sound "${soundTitle}" Was Rejected`;
      await this.transporter.sendMail({
        from: this.emailFrom,
        to: email,
        subject,
        html,
      });
      this.logger.log(`Sound review notification sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send sound review email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendWithdrawalRequested(email: string, amount: number, bankName: string, accountNo: string, userName: string = 'Creator') {
    try {
      const html = `
        <!DOCTYPE html><html><head><style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { color: #7c3aed; margin-bottom: 20px; }
          .info { background-color: #f5f3ff; padding: 15px; border-left: 4px solid #7c3aed; margin: 20px 0; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        </style></head><body>
          <div class="container">
            <h1 class="header">Withdrawal Request Submitted</h1>
            <p>Hi ${userName},</p>
            <p>Your withdrawal request has been received and is pending admin review.</p>
            <div class="info">
              <p><strong>Amount:</strong> Rp ${amount.toLocaleString('id-ID')}</p>
              <p><strong>Bank:</strong> ${bankName}</p>
              <p><strong>Account:</strong> ${accountNo}</p>
              <p><strong>Status:</strong> Pending</p>
            </div>
            <p>You'll be notified by email once it's processed (usually within 1-3 business days).</p>
            <div class="footer"><p>BeatHive © 2026. All rights reserved.</p></div>
          </div>
        </body></html>
      `;
      await this.transporter.sendMail({ from: this.emailFrom, to: email, subject: 'Withdrawal Request Submitted', html });
      this.logger.log(`Withdrawal requested email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send withdrawal requested email to ${email}: ${err.message}`);
      throw err;
    }
  }

  async sendSubscriptionExpiring(email: string, userName: string, planName: string, expiryDate: string) {
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#7c3aed">Subscription kamu akan habis dalam 7 hari</h2>
      <p>Hi ${userName},</p>
      <p>Subscription <strong>${planName}</strong> kamu akan berakhir pada <strong>${expiryDate}</strong>.</p>
      <p>Perpanjang sekarang untuk tetap bisa download sound tanpa batas.</p>
      <a href="${process.env.FRONTEND_URL}/pricing" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Perpanjang Sekarang</a>
      <p style="color:#999;font-size:12px;margin-top:24px">BeatHive &copy; 2026</p>
    </body></html>`;
    await this.transporter.sendMail({ from: this.emailFrom, to: email, subject: `Subscription ${planName} berakhir dalam 7 hari`, html }).catch(e => this.logger.error(e.message));
  }

  async sendQuotaLow(email: string, userName: string, remaining: number, limit: number) {
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#f59e0b">Kuota download hampir habis</h2>
      <p>Hi ${userName},</p>
      <p>Kamu hanya punya <strong>${remaining} download</strong> tersisa dari ${limit}/bulan.</p>
      <p>Upgrade plan untuk mendapatkan lebih banyak download.</p>
      <a href="${process.env.FRONTEND_URL}/pricing" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Lihat Plan</a>
      <p style="color:#999;font-size:12px;margin-top:24px">BeatHive &copy; 2026</p>
    </body></html>`;
    await this.transporter.sendMail({ from: this.emailFrom, to: email, subject: `Sisa ${remaining} download bulan ini`, html }).catch(e => this.logger.error(e.message));
  }

  async sendSoundSold(creatorEmail: string, creatorName: string, soundTitle: string, amount: number, licenseType: string) {
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#10b981">Sound kamu terjual!</h2>
      <p>Hi ${creatorName},</p>
      <p>Sound <strong>"${soundTitle}"</strong> baru saja dibeli dengan <strong>${licenseType} license</strong>.</p>
      <p>Earning kamu bertambah <strong>Rp ${amount.toLocaleString('id-ID')}</strong>.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/earnings" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Lihat Earnings</a>
      <p style="color:#999;font-size:12px;margin-top:24px">BeatHive &copy; 2026</p>
    </body></html>`;
    await this.transporter.sendMail({ from: this.emailFrom, to: creatorEmail, subject: `Sound terjual: "${soundTitle}"`, html }).catch(e => this.logger.error(e.message));
  }

  async sendEmailVerification(email: string, userName: string, verifyUrl: string) {
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#7c3aed">Verifikasi Email BeatHive</h2>
      <p>Hi ${userName},</p>
      <p>Terima kasih telah mendaftar di BeatHive! Klik tombol di bawah untuk verifikasi email kamu.</p>
      <a href="${verifyUrl}" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">Verifikasi Email</a>
      <p style="color:#999;font-size:12px">Link berlaku 24 jam. Jika tidak mendaftar, abaikan email ini.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">BeatHive &copy; 2026</p>
    </body></html>`;
    await this.transporter.sendMail({ from: this.emailFrom, to: email, subject: 'Verifikasi Email BeatHive', html }).catch(e => this.logger.error(e.message));
  }

  // HTML Templates
  private getPasswordResetTemplate(resetUrl: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #7c3aed; margin-bottom: 20px; }
            .btn { background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">Reset Your Password</h1>
            <p>Hi ${userName},</p>
            <p>We received a request to reset your BeatHive password. Click the button below to set a new password.</p>
            <a href="${resetUrl}" class="btn">Reset Password</a>
            <p>If you didn't request this, you can ignore this email. This link expires in 1 hour.</p>
            <div class="footer">
              <p>BeatHive © 2026. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWithdrawalApprovedTemplate(amount: number, bankDetails: { bankName: string; accountNo: string }, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #10b981; margin-bottom: 20px; }
            .info { background-color: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">✓ Withdrawal Approved</h1>
            <p>Hi ${userName},</p>
            <p>Great news! Your withdrawal request has been approved and is being processed.</p>
            <div class="info">
              <p><strong>Amount:</strong> Rp ${amount.toLocaleString('id-ID')}</p>
              <p><strong>Bank:</strong> ${bankDetails.bankName}</p>
              <p><strong>Account:</strong> ${bankDetails.accountNo}</p>
              <p><strong>Expected arrival:</strong> 1-3 business days</p>
            </div>
            <p>You'll receive another notification once the transfer is complete.</p>
            <div class="footer">
              <p>BeatHive © 2026. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWithdrawalRejectedTemplate(amount: number, reason: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #ef4444; margin-bottom: 20px; }
            .info { background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">Withdrawal Request Rejected</h1>
            <p>Hi ${userName},</p>
            <p>Unfortunately, your withdrawal request could not be processed.</p>
            <div class="info">
              <p><strong>Amount:</strong> Rp ${amount.toLocaleString('id-ID')}</p>
              <p><strong>Reason:</strong> ${reason}</p>
            </div>
            <p>Please check your profile to ensure all bank details are correct, then try again. Contact support if you need help.</p>
            <div class="footer">
              <p>BeatHive © 2026. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPaymentConfirmedTemplate(orderId: string, totalAmount: number, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #10b981; margin-bottom: 20px; }
            .order-id { background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">✓ Payment Confirmed</h1>
            <p>Hi ${userName},</p>
            <p>Thank you! Your payment has been confirmed and your sounds are ready to download.</p>
            <p><strong>Order ID:</strong></p>
            <div class="order-id">${orderId}</div>
            <p><strong>Amount:</strong> Rp ${totalAmount.toLocaleString('id-ID')}</p>
            <p>Go to your dashboard to view and download your sounds.</p>
            <div class="footer">
              <p>BeatHive © 2026. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSoundReviewTemplate(soundTitle: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string, userName: string = 'Creator'): string {
    const isApproved = status === 'APPROVED';
    const headerColor = isApproved ? '#10b981' : '#ef4444';
    const bgColor = isApproved ? '#f0fdf4' : '#fef2f2';
    const borderColor = isApproved ? '#10b981' : '#ef4444';
    const statusText = isApproved ? '✓ Approved' : 'Rejected';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: ${headerColor}; margin-bottom: 20px; }
            .info { background-color: ${bgColor}; padding: 15px; border-left: 4px solid ${borderColor}; margin: 20px 0; }
            .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">${statusText}: "${soundTitle}"</h1>
            <p>Hi ${userName},</p>
            <p>${isApproved ? 'Great news! Your sound has been approved and is now live on BeatHive.' : 'Your sound submission has been reviewed and unfortunately was not approved.'}</p>
            <div class="info">
              <p><strong>Sound Title:</strong> ${soundTitle}</p>
              <p><strong>Status:</strong> ${status}</p>
              ${reviewNote ? `<p><strong>Feedback:</strong> ${reviewNote}</p>` : ''}
            </div>
            ${isApproved ? '<p>Your sound is now available for download!</p>' : '<p>Review the feedback and try uploading again. We\'re here to help!</p>'}
            <div class="footer">
              <p>BeatHive © 2026. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
