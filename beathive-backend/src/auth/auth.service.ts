// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  // ─── Register dengan email ──────────────────────────────

  async register(dto: RegisterDto) {
    // Cek email sudah dipakai
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Buat user + langsung assign free plan
    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: 'free' },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          provider: 'email',
          role: 'USER',
        },
      });

      // Buat subscription free plan
      if (freePlan) {
        await tx.subscription.create({
          data: {
            userId: newUser.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2099-12-31'), // free plan tidak expire
          },
        });
      }

      return newUser;
    });

    // Kirim email verifikasi (fire-and-forget)
    const verifyToken = this.jwt.sign(
      { sub: user.id, type: 'email-verify' },
      { expiresIn: '24h' },
    );
    // Update token di DB (gunakan $executeRaw agar backward-compatible)
    try {
      await this.prisma.$executeRaw`
        UPDATE users SET email_verified = false, email_verify_token = ${verifyToken} WHERE id = ${user.id}
      `;
    } catch { /* kolom mungkin belum ada — migration diperlukan */ }

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3001';
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${verifyToken}`;

    // Fire-and-forget: send verification email
    this.email.sendEmailVerification(user.email, user.name, verifyUrl).catch(() => {});

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
      emailVerified: false,
      message: 'Pendaftaran berhasil! Cek email untuk verifikasi akun.',
    };
  }

  // ─── Verify email ────────────────────────────────────────

  async verifyEmail(token: string) {
    try {
      const payload = this.jwt.verify(token) as any;
      if (payload.type !== 'email-verify') throw new Error('Invalid token type');

      await this.prisma.$executeRaw`
        UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = ${payload.sub}
      `;
      return { message: 'Email berhasil diverifikasi!' };
    } catch {
      throw new BadRequestException('Token verifikasi tidak valid atau sudah expired.');
    }
  }

  // ─── Resend email verification ────────────────────────────

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if ((user as any).emailVerified) throw new BadRequestException('Email sudah terverifikasi');

    const verifyToken = this.jwt.sign(
      { sub: user.id, type: 'email-verify' },
      { expiresIn: '24h' },
    );
    await this.prisma.$executeRaw`
      UPDATE users SET email_verify_token = ${verifyToken} WHERE id = ${userId}
    `;

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3001';
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${verifyToken}`;
    await this.email.sendEmailVerification(user.email, user.name, verifyUrl).catch(() => {});

    return { message: 'Email verifikasi telah dikirim ulang.' };
  }

  // ─── Login dengan email ─────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // If 2FA is enabled, require TOTP token
    if (user.isTwoFactorEnabled && user.totpSecret) {
      if (!dto.totpToken) {
        return { requiresTwoFactor: true, userId: user.id };
      }
      const valid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: dto.totpToken, window: 1 });
      if (!valid) throw new UnauthorizedException('Invalid 2FA code');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Refresh access token ───────────────────────────────

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException();

      const tokens = await this.generateTokens(user.id, user.email);
      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  // ─── Google OAuth callback ──────────────────────────────

  async handleGoogleCallback(googleUser: {
    email: string;
    name: string;
    picture: string;
    googleId: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      // User baru via Google — buat akun + free plan
      const freePlan = await this.prisma.plan.findUnique({
        where: { slug: 'free' },
      });

      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: googleUser.name,
            email: googleUser.email,
            avatarUrl: googleUser.picture,
            provider: 'google',
            providerId: googleUser.googleId,
          },
        });

        if (freePlan) {
          await tx.subscription.create({
            data: {
              userId: newUser.id,
              planId: freePlan.id,
              status: 'ACTIVE',
              currentPeriodEnd: new Date('2099-12-31'),
            },
          });
        }

        return newUser;
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Generate short-lived auth code for OAuth callback ──
  // Instead of putting real tokens in the URL, we generate a one-time code
  // that the frontend exchanges for tokens via a secure POST request.

  async generateAuthCode(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, type: 'auth-code' },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '2m', // very short-lived
      },
    );
  }

  async exchangeAuthCode(code: string) {
    interface AuthCodePayload { sub: string; type: string }
    let decoded: AuthCodePayload;
    try {
      decoded = await this.jwt.verifyAsync<AuthCodePayload>(code, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired auth code');
    }

    if (decoded.type !== 'auth-code') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        subscription: { include: { plan: true } },
      },
    });

    if (!user) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user.id, user.email);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Get current user (dari JWT) ───────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException();
    return this.sanitizeUser(user);
  }

  // ─── Public profile (visible to anyone) ────────────────

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true, bio: true, createdAt: true },
    });
    if (!user) return null;

    const [soundCount, sounds, aggregates] = await Promise.all([
      this.prisma.soundEffect.count({ where: { authorId: userId, isPublished: true } }),
      this.prisma.soundEffect.findMany({
        where: { authorId: userId, isPublished: true },
        orderBy: { downloadCount: 'desc' },
        take: 20,
        select: {
          id: true, title: true, slug: true, accessLevel: true, price: true,
          durationMs: true, downloadCount: true, playCount: true, previewUrl: true, waveformData: true,
          format: true,
          category: { select: { name: true, slug: true } },
          tags: { take: 10, select: { tag: { select: { name: true, slug: true } } } },
        },
      }),
      this.prisma.soundEffect.aggregate({
        where: { authorId: userId, isPublished: true },
        _sum: { playCount: true, downloadCount: true },
      }),
    ]);

    const flatSounds = sounds.map((s: any) => ({
      ...s,
      tags: s.tags?.map((t: any) => t.tag) ?? [],
    }));

    return {
      ...user,
      soundCount,
      totalPlays: aggregates._sum.playCount ?? 0,
      totalDownloads: aggregates._sum.downloadCount ?? 0,
      sounds: flatSounds,
    };
  }

  // ─── Update profile (name + bio) ───────────────────────

  async updateProfile(userId: string, dto: { name?: string; bio?: string; bankName?: string; bankAccount?: string; bankAccountName?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name?.trim() && { name: dto.name.trim() }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName || null }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount || null }),
        ...(dto.bankAccountName !== undefined && { bankAccountName: dto.bankAccountName || null }),
      },
    });
    return this.sanitizeUser(updated);
  }

  // ─── Upload avatar ──────────────────────────────────────

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const { v4: uuidv4 } = await import('uuid');
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(avatarsDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return { avatarUrl, user: this.sanitizeUser(updated) };
  }

  // ─── Change password ────────────────────────────────────

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (!user.passwordHash) {
      throw new BadRequestException('This account uses Google login — password change not available');
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new BadRequestException('Current password is incorrect');

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password updated successfully' };
  }

  // ─── Password Reset ─────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return { message: 'If email exists, a reset link has been sent' };
    }

    const resetSecret = this.config.get<string>('JWT_RESET_SECRET');
    if (!resetSecret) throw new Error('JWT_RESET_SECRET env var is required');

    const resetToken = await this.jwt.signAsync(
      { sub: user.id, email, type: 'password-reset' },
      { secret: resetSecret, expiresIn: '1h' },
    );

    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    try {
      await this.email.sendPasswordReset(email, resetUrl, user.name);
    } catch (err) {
      // Log but don't throw (email sending is non-critical)
      console.error('Failed to send password reset email:', err);
    }

    return { message: 'If email exists, a reset link has been sent' };
  }

  // ─── 2FA (TOTP) ─────────────────────────────────────────

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = speakeasy.generateSecret({ name: `BeatHive (${user.email})`, length: 20 });

    // Store temp secret (not yet enabled until verified)
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret.base32 } });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCode: qrDataUrl };
  }

  async verify2FASetup(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('2FA setup not started');

    const valid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token, window: 1 });
    if (!valid) throw new BadRequestException('Invalid 2FA code');

    await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: true } });
    return { message: '2FA enabled successfully' };
  }

  async disable2FA(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.passwordHash) {
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) throw new BadRequestException('Incorrect password');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, isTwoFactorEnabled: false },
    });
    return { message: '2FA disabled' };
  }

  async verifyTotpForLogin(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) return false;
    return speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token, window: 1 });
  }

  async resetPassword(token: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const resetSecret = this.config.get<string>('JWT_RESET_SECRET');
    if (!resetSecret) throw new Error('JWT_RESET_SECRET env var is required');

    interface ResetPayload { sub: string; email: string; type: string }
    let decoded: ResetPayload;
    try {
      decoded = await this.jwt.verifyAsync<ResetPayload>(token, { secret: resetSecret });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (decoded.type !== 'password-reset') {
      throw new BadRequestException('Invalid token type');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: decoded.sub },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  // ─── Helpers ────────────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, totpSecret, ...safe } = user;
    return safe;
  }
}
