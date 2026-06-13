// src/auth/dto/login.dto.ts
import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(254)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MaxLength(72, { message: 'Password terlalu panjang' }) // bcrypt DoS prevention
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  totpToken?: string;
}

// src/auth/dto/refresh-token.dto.ts
export class RefreshTokenDto {
  @IsString()
  @MaxLength(500) // JWT refresh token typical max length
  refreshToken: string;
}

