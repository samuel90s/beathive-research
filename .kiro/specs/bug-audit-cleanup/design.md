# Design Document: Bug Audit & Dead Code Cleanup

## Overview

This document describes the implementation approach for the 14 requirements identified in the audit. Changes fall into two categories:

1. **Bug fixes** (Requirements 1–7): Runtime and logic errors that cause incorrect behavior in production
2. **Dead code removal** (Requirements 8–14): Files, methods, and parameters that are unused and create maintenance confusion

No new dependencies are introduced. All changes are limited to existing files, except for the deletion of dead files.

---

## Architecture

No architectural changes are required. All fixes are isolated to the files identified in the audit. The service/controller/module structure remains unchanged.

---

## Components and Interfaces

### BUG-01: AuthController + AuthService — `forgotPassword` signature mismatch

**Root cause:** `AuthController.forgotPassword` calls `this.authService.forgotPassword(body.email, this.emailService)`, but `this.emailService` is never declared in `AuthController`'s constructor. `AuthService` already has `EmailService` injected as `private email: EmailService`.

**Fix:**

*In `auth.controller.ts`*: Change the call from:
```typescript
return this.authService.forgotPassword(body.email, this.emailService);
```
to:
```typescript
return this.authService.forgotPassword(body.email);
```

*In `auth.service.ts`*: Change the method signature from:
```typescript
async forgotPassword(email: string, emailService: any) {
  // ...
  await emailService.sendPasswordReset(email, resetUrl, user.name);
```
to:
```typescript
async forgotPassword(email: string) {
  // ...
  await this.email.sendPasswordReset(email, resetUrl, user.name);
```

The `emailService` parameter is removed entirely. All email sending goes through the already-injected `this.email`.

---

### BUG-02: SoundsService — `subscription` variable scope

**Root cause:** `subscription` is declared inside the `if (!alreadyPurchased)` block, but referenced later in the outer scope in:
```typescript
const needsQuotaCheck = !alreadyPurchased && subscription && ...
```

**Fix:** Hoist the declaration to the top of the method body:

```typescript
async requestDownload(soundId: string, userId: string) {
  // ...existing sound lookup...

  const alreadyPurchased = await this.prisma.orderItem.findFirst({ ... });

  // Declare subscription at top scope, initialised to null
  let subscription: Awaited<ReturnType<typeof this.prisma.subscription.findUnique>> | null = null;

  if (!alreadyPurchased) {
    subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    // ...access checks using local subscription variable...
  }

  // Now safe to reference subscription here
  const needsQuotaCheck = !alreadyPurchased && subscription && !subscription.plan.unlimited;
  // ...rest of method...
}
```

---

### BUG-03: AdminPage — wrong storage API

**Root cause:** Line `const token = accessToken || localStorage.getItem('accessToken')` uses `localStorage`, but the entire app writes tokens to `sessionStorage`.

**Fix:** In `beathive-frontend/src/app/admin/page.tsx`, change:
```typescript
const token = accessToken || localStorage.getItem('accessToken');
```
to:
```typescript
const token = accessToken || sessionStorage.getItem('accessToken');
```

---

### BUG-04: EmailService — missing `from` field

**Root cause:** The constructor loads `emailFrom` from config but never stores it as an instance field. All `sendMail()` calls omit `from:`.

**Fix:** In `email.service.ts`, store `emailFrom` as a private field and add it to every `transporter.sendMail()` call:

```typescript
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly emailFrom: string;       // ← add this
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    this.emailFrom = this.config.get<string>('EMAIL_FROM', 'noreply@beathive.com');
    // ...existing transporter setup...
  }

  async sendPasswordReset(email: string, resetUrl: string, userName = 'User') {
    await this.transporter.sendMail({
      from: this.emailFrom,   // ← add to all calls
      to: email,
      subject: 'Reset Your BeatHive Password',
      html: this.getPasswordResetTemplate(resetUrl, userName),
    });
    // ...
  }
  // Repeat for all 9 other sendMail() calls
}
```

All 10 affected methods: `sendPasswordReset`, `sendWithdrawalApproved`, `sendWithdrawalRejected`, `sendPaymentConfirmed`, `sendSoundReviewNotification`, `sendWithdrawalRequested`, `sendSubscriptionExpiring`, `sendQuotaLow`, `sendSoundSold`, `sendEmailVerification`.

---

### BUG-05: VerifyEmailPage — non-functional resend button

**Root cause:** The button renders with no `onClick` handler — it is entirely inert.

**Fix:** Add state management and an API call using the existing `apiClient`:

```typescript
'use client';
import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

// inside VerifyEmailContent():
const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
const { accessToken } = useAuthStore();

const handleResend = async () => {
  if (!accessToken) return;
  setResendStatus('loading');
  try {
    await apiClient.post('/auth/resend-verification');
    setResendStatus('sent');
  } catch {
    setResendStatus('error');
  }
};
```

The button element:
```tsx
<button
  onClick={handleResend}
  disabled={resendStatus === 'loading' || resendStatus === 'sent'}
  className="text-accent-bright hover:underline disabled:opacity-50"
>
  {resendStatus === 'loading' ? 'Mengirim...' : 'Kirim ulang'}
</button>
```

Status messages below the button:
```tsx
{resendStatus === 'sent' && (
  <p className="text-xs text-teal-400 mt-2">Email verifikasi telah dikirim ulang.</p>
)}
{resendStatus === 'error' && (
  <p className="text-xs text-red-400 mt-2">Gagal mengirim email. Coba lagi.</p>
)}
```

The `apiClient` already injects the `Authorization` header via its request interceptor — no manual header manipulation is needed.

---

### BUG-06: LoginDto — missing `totpToken` field

**Root cause:** `AuthService.login` accesses `dto.totpToken`, but `LoginDto` does not declare this field. TypeScript currently bridges this with an intersection type `LoginDto & { totpToken?: string }` in the service signature.

**Fix:** In `beathive-backend/src/auth/dto/login.dto.ts`:
```typescript
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpToken?: string;
}
```

In `AuthService`, simplify the method signature:
```typescript
async login(dto: LoginDto) {   // remove "& { totpToken?: string }"
```

---

### BUG-07: SoundsService — `isFree` + price filter conflict

**Root cause:** When `isFree=true` sets `where.price = 0`, the subsequent `minPrice` spread block incorrectly overwrites it:
```typescript
if (filters.minPrice !== undefined) {
  where.price = { ...(where.price && typeof where.price === 'object' ? where.price : {}), gte: filters.minPrice };
}
```
Since `0` is falsy, `where.price && typeof where.price === 'object'` evaluates to `false`, so the spread spreads an empty object and the `price = 0` constraint is silently dropped.

**Fix:** Guard the `minPrice`/`maxPrice` blocks with an `isFree` check:

```typescript
// Set isFree filter first
if (isFree !== undefined) {
  where.price = (String(isFree) === 'true' || isFree === true) ? 0 : { gt: 0 };
}

// Only apply price range filters when isFree is NOT set
if (isFree === undefined) {
  if (filters.minPrice !== undefined) {
    where.price = { ...(typeof where.price === 'object' && where.price !== null ? where.price : {}), gte: filters.minPrice };
  }
  if (filters.maxPrice !== undefined) {
    where.price = { ...(typeof where.price === 'object' && where.price !== null ? where.price : {}), lte: filters.maxPrice };
  }
}
```

---

### Dead Code Removals (Requirements 8–14)

| ID | Target | Action |
|----|--------|--------|
| DEAD-01 | `beathive-frontend/src/lib/api.ts` | Delete file |
| DEAD-02 | `beathive-frontend/src/store/auth.store.ts` | Delete file |
| DEAD-02 | `beathive-frontend/src/store/player.store.ts` | Delete file |
| DEAD-03 | `buildLicenseText()` in `SoundsController` | Delete method body (~100 lines) |
| DEAD-04 | `beathive-frontend/src/lib/hooks/useKeyboardShortcuts.ts` | Delete file |
| DEAD-05 | `beathive-backend/src/common/guards/subscription.guard.ts` | Delete file |
| DEAD-06 | `role?` param in `authApi.register` | Remove parameter and from POST body |
| DEAD-07 | `isFree?: boolean` in `SoundEffect` type | Change to `isFree: boolean` (required) |

**DEAD-05 note:** `SubscriptionGuard` is defined but never registered as a provider in any module (`AppModule`, `SoundsModule`, etc.) and never applied via `@UseGuards()`. Deleting it has zero runtime impact.

**DEAD-07 note:** The audit initially flagged `isFree` as dead. Inspection of `SoundsService.formatSound()` shows it always computes and returns `isFree: sound.price === 0`. The corrective action is to make the field required (`isFree: boolean`) rather than remove it.

---

## Data Models

No data model changes. All fixes are in application logic and TypeScript types only.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature is primarily composed of bug fixes and dead code removals. Most acceptance criteria are best validated through specific example tests. However, two criteria are amenable to property-based testing:

### Property 1: EmailService always includes a `from` field

*For any* `EmailService` send-method call with valid arguments, the `transporter.sendMail()` call SHALL include a `from` field equal to the configured `EMAIL_FROM` value.

**Validates: Requirements 4.1, 4.3**

### Property 2: `isFree=true` filter always overrides price range filters

*For any* combination of `SoundFilterDto` where `isFree=true`, the resulting Prisma `where.price` clause SHALL be exactly `0` and SHALL NOT contain `gte` or `lte` keys, regardless of what `minPrice` or `maxPrice` values are also provided in the same filter.

**Validates: Requirements 7.1, 7.4**

---

## Error Handling

- **BUG-01 fix:** `AuthService.forgotPassword` already has a try/catch around the email send. This behavior is preserved — errors are logged but do not throw to the client.
- **BUG-02 fix:** If `subscription` is `null` (e.g., user has no subscription record), the existing access-check logic already throws `ForbiddenException` appropriately.
- **BUG-05 fix:** The resend button shows a user-facing error message on failure. The `apiClient` handles 401 token refresh automatically.
- **Dead code removal:** No error handling changes — none of the deleted items had associated error paths.

---

## Testing Strategy

### Approach

This cleanup task involves targeted, well-scoped changes. Testing focuses on:
- **Example-based unit tests** for each bug fix to verify the specific scenario is corrected
- **Property-based tests** for the two properties identified above (EmailService `from` field, and `isFree` filter precedence)
- **Compile-time validation** (TypeScript build) confirms that dead code removal does not break imports

### Unit Tests (example-based)

**BUG-01 (AuthController/Service):**
- Call `forgotPassword('test@example.com')` via the service; verify `EmailService.sendPasswordReset` is called once with the correct email
- Confirm no `emailService` property exists on `AuthController` instance

**BUG-02 (SoundsService.requestDownload):**
- Mock scenario: user with active subscription, sound requiring PRO access → verify no ReferenceError, quota check executes
- Mock scenario: user who already purchased → verify subscription query is skipped, download proceeds

**BUG-03 (AdminPage):**
- Render `AdminPage` with `sessionStorage` containing a token; verify `fetch` is called with `Authorization: Bearer <token>`
- Verify no call to `localStorage.getItem` occurs during mount

**BUG-04 (EmailService):**
- Property test (see above) — verified via mock on `transporter.sendMail`

**BUG-05 (VerifyEmailPage):**
- Render the pending-verification state; click "Kirim ulang"; verify `apiClient.post('/auth/resend-verification')` is called
- Verify button is disabled during loading state
- Verify success message appears after mock resolves
- Verify error message appears after mock rejects

**BUG-06 (LoginDto):**
- Submit a login body with `totpToken: '123456'`; confirm `class-validator` validates it as a string
- Submit a login body without `totpToken`; confirm validation passes

**BUG-07 (SoundsService.findAll):**
- Property test (see above)
- Example: `{ isFree: false, minPrice: 100, maxPrice: 500 }` → where.price should contain `{ gt: 0, gte: 100, lte: 500 }`
- Example: `{ minPrice: 100 }` (no `isFree`) → where.price should contain `{ gte: 100 }`

### Property-Based Tests

Using **fast-check** (TypeScript, already compatible with Jest/Vitest) for both properties.

**Property 1 — EmailService `from` field:**
```
Tag: Feature: bug-audit-cleanup, Property 1: EmailService always includes from field
```
Generator: arbitrary valid email addresses, arbitrary send-method calls across all 10 methods.
Assertion: captured `sendMail` argument always has `from: emailFrom`.
Minimum iterations: 100.

**Property 2 — `isFree` filter precedence:**
```
Tag: Feature: bug-audit-cleanup, Property 2: isFree=true overrides price range filters
```
Generator: arbitrary `minPrice` (0–10_000_000) and `maxPrice` values alongside `isFree=true`.
Assertion: the constructed `where.price` is `0` (not an object with `gte`/`lte`).
Minimum iterations: 100.

### Dead Code Removal Verification

For each deleted file/method, confirm after deletion:
1. `npx tsc --noEmit` passes with zero errors (TypeScript build check)
2. `grep` / IDE search finds no remaining import of the deleted symbol
