// src/common/guards/optional-jwt-auth.guard.ts
// Guard yang tidak memblokir request kalau tidak ada token.
// req.user akan terisi kalau JWT valid, null kalau tidak ada token.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest — kalau error/tidak ada token, kembalikan null (bukan throw)
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }

  // Override canActivate — selalu izinkan, bahkan tanpa token
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token or invalid token — lanjut saja, req.user = null
    }
    return true;
  }
}
