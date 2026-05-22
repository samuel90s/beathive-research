# Implementation Plan: Bug Audit & Dead Code Cleanup

## Overview

Atomic implementation tasks for all 14 requirements. Each task references the specific requirement(s) it satisfies. Tasks are ordered so that backend fixes come first, followed by frontend fixes, then dead code removal. Dead code removals are grouped at the end because they are purely subtractive and carry zero risk of breaking other fixes.

## Tasks

- [x] 1. Fix AuthController/AuthService `forgotPassword` signature mismatch (BUG-01)
  - In `beathive-backend/src/auth/auth.controller.ts`: change the call on the `forgotPassword` handler from `this.authService.forgotPassword(body.email, this.emailService)` to `this.authService.forgotPassword(body.email)`
  - In `beathive-backend/src/auth/auth.service.ts`: change the method signature from `async forgotPassword(email: string, emailService: any)` to `async forgotPassword(email: string)`, and replace every `emailService.sendPasswordReset(...)` call in the method body with `this.email.sendPasswordReset(...)`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 Write unit test for forgotPassword delegation
    - Mock `EmailService.sendPasswordReset`; call `authService.forgotPassword('test@example.com')`; assert mock was called once with the correct args and no error is thrown
    - _Requirements: 1.1, 1.2_

- [x] 2. Fix `subscription` variable scope in `SoundsService.requestDownload` (BUG-02)
  - In `beathive-backend/src/sounds/sounds.service.ts`, method `requestDownload`: declare `let subscription: ... | null = null` immediately after the `alreadyPurchased` query, before the `if (!alreadyPurchased)` block
  - Move the `prisma.subscription.findUnique(...)` call inside the `if` block so it assigns to the top-scope `subscription` variable
  - Verify `needsQuotaCheck` now correctly reads the hoisted `subscription`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.1 Write unit test for requestDownload with subscriber
    - Mock scenario: sound with `accessLevel='PRO'`, user with ACTIVE PRO subscription, no prior purchase → assert method resolves without ReferenceError and quota check runs
    - _Requirements: 2.1, 2.3_

  - [ ]* 2.2 Write unit test for requestDownload with existing purchase
    - Mock scenario: `alreadyPurchased` returns a record → assert `prisma.subscription.findUnique` is NOT called and method resolves successfully
    - _Requirements: 2.4_

- [x] 3. Fix token storage in AdminPage (BUG-03)
  - In `beathive-frontend/src/app/admin/page.tsx`: change `localStorage.getItem('accessToken')` to `sessionStorage.getItem('accessToken')` in the `useEffect`
  - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 3.1 Write unit test for AdminPage token read
    - Render `AdminPage` with mocked `useAuthStore` returning null token; populate `sessionStorage` with a test token; assert the `fetch` call includes `Authorization: Bearer <test-token>`; assert `localStorage.getItem` is never called
    - _Requirements: 3.1, 3.3_

- [x] 4. Fix missing `from` field in EmailService (BUG-04)
  - In `beathive-backend/src/email/email.service.ts`: add `private readonly emailFrom: string` field; assign it in the constructor from `this.config.get<string>('EMAIL_FROM', 'noreply@beathive.com')`
  - Add `from: this.emailFrom` to the `transporter.sendMail()` options object in all 10 methods: `sendPasswordReset`, `sendWithdrawalApproved`, `sendWithdrawalRejected`, `sendPaymentConfirmed`, `sendSoundReviewNotification`, `sendWithdrawalRequested`, `sendSubscriptionExpiring`, `sendQuotaLow`, `sendSoundSold`, `sendEmailVerification`
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.1 Write property test for EmailService `from` field (Property 1)
    - **Property 1: EmailService always includes a `from` field**
    - **Validates: Requirements 4.1, 4.3**
    - Using fast-check: for each of the 10 send-methods, generate arbitrary valid arguments; spy on `transporter.sendMail`; assert every captured call has `from` equal to the configured `emailFrom` value
    - Run minimum 100 iterations
    - _Requirements: 4.1, 4.3_

- [x] 5. Fix non-functional resend button on VerifyEmailPage (BUG-05)
  - In `beathive-frontend/src/app/auth/verify-email/page.tsx`, inside `VerifyEmailContent`:
    - Add `useState<'idle' | 'loading' | 'sent' | 'error'>('idle')` for `resendStatus`
    - Import `apiClient` from `@/lib/api/client` and `useAuthStore` from `@/lib/store/auth.store`
    - Implement `handleResend` async function: set loading, call `apiClient.post('/auth/resend-verification')`, set `'sent'` on success or `'error'` on catch
    - Attach `onClick={handleResend}` and `disabled={resendStatus === 'loading' || resendStatus === 'sent'}` to the "Kirim ulang" button
    - Render a success message when `resendStatus === 'sent'` and an error message when `resendStatus === 'error'`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.1 Write unit tests for VerifyEmailPage resend flow
    - Test: click "Kirim ulang" → `apiClient.post('/auth/resend-verification')` is called; button is disabled during loading; success message appears on resolve
    - Test: API rejects → error message appears
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Add `totpToken` field to `LoginDto` (BUG-06)
  - In `beathive-backend/src/auth/dto/login.dto.ts`: add `@IsOptional() @IsString() totpToken?: string;` with `IsOptional` and `IsString` imported from `class-validator`
  - In `beathive-backend/src/auth/auth.service.ts`: change the `login` method signature from `async login(dto: LoginDto & { totpToken?: string })` to `async login(dto: LoginDto)`
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.1 Write unit tests for LoginDto validation
    - Test: payload `{ email, password, totpToken: '123456' }` passes `class-validator` validation
    - Test: payload `{ email, password }` (no `totpToken`) also passes validation
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. Fix `isFree` + `minPrice` filter conflict in `SoundsService.findAll` (BUG-07)
  - In `beathive-backend/src/sounds/sounds.service.ts`, method `findAll`: wrap the `minPrice` and `maxPrice` assignment blocks inside a `if (isFree === undefined)` guard so they are skipped when `isFree` is set
  - Ensure the existing `if (isFree !== undefined)` block that assigns `where.price = 0` or `{ gt: 0 }` remains unchanged and runs before the guarded price-range block
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 7.1 Write property test for `isFree` filter precedence (Property 2)
    - **Property 2: `isFree=true` filter always overrides price range filters**
    - **Validates: Requirements 7.1, 7.4**
    - Using fast-check: generate arbitrary `minPrice` (integer 0–10_000_000) and `maxPrice` values; call `findAll` with `{ isFree: true, minPrice, maxPrice }` using a Prisma mock that captures the `where` argument; assert `where.price === 0` (not an object) in every iteration
    - Run minimum 100 iterations
    - _Requirements: 7.1, 7.4_

  - [ ]* 7.2 Write unit tests for price filter combinations
    - Test: `{ isFree: false, minPrice: 100, maxPrice: 500 }` → `where.price` contains `gt: 0, gte: 100, lte: 500`
    - Test: `{ minPrice: 100 }` (no `isFree`) → `where.price` contains `gte: 100`
    - Test: `{ isFree: true }` alone → `where.price === 0`
    - _Requirements: 7.2, 7.3_

- [x] 8. Checkpoint — run TypeScript build to confirm bug fixes compile
  - Run `npx tsc --noEmit` in both `beathive-backend` and `beathive-frontend`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Remove legacy API client (DEAD-01)
  - Delete the file `beathive-frontend/src/lib/api.ts`
  - Run a codebase search for any import referencing `@/lib/api` or `'../lib/api'` and confirm zero matches remain
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Remove redundant store re-export wrappers (DEAD-02)
  - Delete `beathive-frontend/src/store/auth.store.ts`
  - Delete `beathive-frontend/src/store/player.store.ts`
  - Run a codebase search for imports targeting `@/store/auth.store` or `@/store/player.store` and confirm zero matches remain
  - Confirm `beathive-frontend/src/lib/store/auth.store.ts` and `beathive-frontend/src/lib/store/player.store.ts` are untouched
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Remove unused `buildLicenseText` method from SoundsController (DEAD-03)
  - In `beathive-backend/src/sounds/sounds.controller.ts`: delete the entire `private buildLicenseText(data: {...}): string { ... }` method (~100 lines)
  - Run a codebase search for any call site of `buildLicenseText` to confirm zero matches
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 12. Remove unused `useKeyboardShortcuts` hook (DEAD-04)
  - Delete the file `beathive-frontend/src/lib/hooks/useKeyboardShortcuts.ts`
  - Run a codebase search for any import of `useKeyboardShortcuts` to confirm zero matches
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 13. Remove unused `SubscriptionGuard` (DEAD-05)
  - Delete the file `beathive-backend/src/common/guards/subscription.guard.ts`
  - Confirm `SubscriptionGuard` is not referenced in any module's `providers` array or any controller's `@UseGuards()` decorator (search confirms it was never registered)
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 14. Remove unused `role` parameter from `authApi.register` (DEAD-06)
  - In `beathive-frontend/src/lib/api/auth.ts`: remove the `role?` parameter from the `register` function signature; remove `role` from the POST body object
  - Run a codebase search for any call site passing a `role` argument to `authApi.register` to confirm zero matches
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 15. Strengthen `isFree` field type in `SoundEffect` interface (DEAD-07)
  - In `beathive-frontend/src/types/index.ts`: change `isFree?: boolean` to `isFree: boolean` in the `SoundEffect` interface
  - _Requirements: 14.1, 14.2_

- [x] 16. Final checkpoint — TypeScript build + full test suite
  - Run `npx tsc --noEmit` in both `beathive-backend` and `beathive-frontend` — zero errors expected
  - Run the full test suite (`npm test` or `npx jest --runInBand` as appropriate for each package)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster pass — the fixes themselves (non-starred tasks) are always required
- Tasks 9–15 (dead code removal) are purely subtractive and can be executed in any order
- The TypeScript build in Task 8 and Task 16 is the primary verification gate for dead code removals — if the build passes, no imports were broken
- Property tests (Tasks 4.1 and 7.1) use **fast-check** — install with `npm install -D fast-check` if not already present
- DEAD-07 (Task 15) is a type strengthening, not a removal — do not delete `isFree` from the interface

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3", "4", "5", "6", "7"],
      "description": "Bug fixes — independent, can run in parallel"
    },
    {
      "wave": 2,
      "tasks": ["8"],
      "description": "Checkpoint — TypeScript build after all bug fixes"
    },
    {
      "wave": 3,
      "tasks": ["9", "10", "11", "12", "13", "14", "15"],
      "description": "Dead code removal — independent, can run in parallel"
    },
    {
      "wave": 4,
      "tasks": ["16"],
      "description": "Final checkpoint — full TypeScript build and test suite"
    }
  ]
}
```
