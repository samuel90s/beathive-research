// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  // Hapus karakter HTML/script berbahaya dari nama
  @Matches(/^[^<>"'`;&|\\${}()]*$/, { message: 'Nama mengandung karakter yang tidak diizinkan' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(254) // RFC 5321 max email length
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @MaxLength(72, { message: 'Password terlalu panjang (max 72 karakter)' }) // bcrypt max
  password: string;
}
