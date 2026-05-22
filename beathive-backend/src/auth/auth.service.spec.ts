/**
 * Unit tests for AuthService.forgotPassword
 * Validates: Requirements 1.1, 1.2
 *
 * These tests verify that:
 *  - AuthService.forgotPassword delegates email sending to the injected EmailService
 *  - No external emailService parameter is required or used
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('AuthService.forgotPassword', () => {
  let authService: AuthService;
  let prismaService: Partial<PrismaService>;
  let emailService: { sendPasswordReset: jest.Mock };
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    emailService = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    prismaService = {
      user: {
        findUnique: jest.fn(),
      } as any,
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-reset-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          JWT_RESET_SECRET: 'test-reset-secret',
          FRONTEND_URL: 'http://localhost:3001',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('calls this.email.sendPasswordReset with correct args when user exists', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    (prismaService.user!.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await authService.forgotPassword('test@example.com');

    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('/auth/reset-password?token='),
      mockUser.name,
    );
    expect(result).toEqual({ message: 'If email exists, a reset link has been sent' });
  });

  it('does not call sendPasswordReset and returns same message when user does not exist', async () => {
    (prismaService.user!.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await authService.forgotPassword('nonexistent@example.com');

    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'If email exists, a reset link has been sent' });
  });

  it('does not accept or use an external emailService parameter', async () => {
    const mockUser = { id: 'user-456', email: 'another@example.com', name: 'Another User' };
    (prismaService.user!.findUnique as jest.Mock).mockResolvedValue(mockUser);

    // The method signature is forgotPassword(email: string) — no second parameter
    // TypeScript enforces this; calling with a second arg would be a compile error.
    // We confirm the method only accepts one argument:
    expect(authService.forgotPassword.length).toBe(1);

    await authService.forgotPassword('another@example.com');

    // Confirm the injected EmailService was used (not some external one)
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'another@example.com',
      expect.any(String),
      mockUser.name,
    );
  });
});
