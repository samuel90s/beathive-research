# Requirements Document

## Introduction

This spec covers a targeted bug-fix and dead-code-removal pass across the BeatHive platform. The audit identified seven bugs (four critical, three medium severity) and seven dead-code items (unused files, re-export wrappers, unregistered guards, and orphaned methods). All changes are backward-compatible — no new features are introduced.

**Backend:** NestJS + Prisma + PostgreSQL (`beathive-backend/src/`)  
**Frontend:** Next.js 14 App Router + Zustand + React Query (`beathive-frontend/src/`)

---

## Glossary

- **AuthController**: `beathive-backend/src/auth/auth.controller.ts` — handles HTTP routes for authentication
- **AuthService**: `beathive-backend/src/auth/auth.service.ts` — business logic for authentication, already has `private email: EmailService` injected
- **EmailService**: `beathive-backend/src/email/email.service.ts` — sends transactional emails via Mailgun SMTP
- **SoundsService**: `beathive-backend/src/sounds/sounds.service.ts` — handles sound CRUD and download logic
- **SoundsController**: `beathive-backend/src/sounds/sounds.controller.ts` — HTTP routes for sounds
- **LoginDto**: `beathive-backend/src/auth/dto/login.dto.ts` — DTO for the POST `/auth/login` endpoint
- **RegisterDto**: `beathive-backend/src/auth/dto/register.dto.ts` — DTO for the POST `/auth/register` endpoint
- **SubscriptionGuard**: `beathive-backend/src/common/guards/subscription.guard.ts` — NestJS guard that checks for an active subscription
- **AdminPage**: `beathive-frontend/src/app/admin/page.tsx` — admin dashboard page component
- **VerifyEmailPage**: `beathive-frontend/src/app/auth/verify-email/page.tsx` — email verification status page
- **LegacyApiClient**: `beathive-frontend/src/lib/api.ts` — old, unused Axios client (to be removed)
- **ApiClient**: `beathive-frontend/src/lib/api/client.ts` — active Axios client with interceptors (source of truth)
- **AuthStoreWrapper**: `beathive-frontend/src/store/auth.store.ts` — single-line re-export wrapper (to be removed)
- **PlayerStoreWrapper**: `beathive-frontend/src/store/player.store.ts` — single-line re-export wrapper (to be removed)
- **KeyboardShortcutsHook**: `beathive-frontend/src/lib/hooks/useKeyboardShortcuts.ts` — implemented but unused player keyboard hook
- **buildLicenseText**: private method in `SoundsController` — never called
- **authApi (frontend)**: `beathive-frontend/src/lib/api/auth.ts` — frontend API helper for auth endpoints
- **SoundEffect (type)**: `beathive-frontend/src/types/index.ts` — TypeScript interface for a sound effect
- **emailFrom**: config variable in EmailService constructor — loaded from `EMAIL_FROM` env var but never passed to `sendMail()`

---

## Requirements

### Requirement 1: Fix EmailService Injection in AuthController (BUG-01 — Critical)

**User Story:** As a user attempting to reset my password, I want the forgot-password endpoint to work correctly, so that I can receive a password reset email.

#### Acceptance Criteria

1. WHEN the POST `/auth/forgot-password` endpoint is called, THE AuthController SHALL delegate the call to `this.authService.forgotPassword(body.email)` without passing `this.emailService` as a parameter.
2. THE AuthService `forgotPassword` method SHALL accept only `(email: string)` as its parameter, using its already-injected `this.email` (EmailService) internally.
3. WHEN the application starts, THE AuthController SHALL NOT reference any `emailService` property that is not declared in its constructor.
4. IF `this.emailService` is referenced in `AuthController` without a constructor injection, THEN THE compiler SHALL produce a TypeScript error at build time.

---

### Requirement 2: Fix Out-of-Scope `subscription` Variable in SoundsService (BUG-02 — Critical)

**User Story:** As a subscriber attempting to download a sound, I want the download quota check to execute correctly, so that I am not blocked by a JavaScript reference error.

#### Acceptance Criteria

1. WHEN the `requestDownload` method executes, THE SoundsService SHALL declare the `subscription` variable at the method's top scope (outside the `if (!alreadyPurchased)` block), initialised to `null`.
2. WHEN `alreadyPurchased` is falsy, THE SoundsService SHALL assign the result of `prisma.subscription.findUnique(...)` to the top-scope `subscription` variable.
3. WHEN `needsQuotaCheck` is evaluated, THE SoundsService SHALL read `subscription` from the top scope so that the expression `!alreadyPurchased && subscription && !subscription.plan.unlimited` resolves without a ReferenceError.
4. WHEN `alreadyPurchased` is truthy, THE SoundsService SHALL leave `subscription` as `null` and SHALL skip the quota check entirely.

---

### Requirement 3: Fix Token Storage Read in AdminPage (BUG-03 — Critical)

**User Story:** As an admin, I want the admin dashboard to authenticate API calls using the correct token storage, so that the stats request is not rejected with 401.

#### Acceptance Criteria

1. WHEN the AdminPage component mounts, THE AdminPage SHALL read the access token from `sessionStorage` rather than `localStorage`.
2. THE AdminPage SHALL use `accessToken` from `useAuthStore()` as the primary source and SHALL fall back to `sessionStorage.getItem('accessToken')` only if the store value is absent.
3. WHEN `localStorage.getItem('accessToken')` is referenced in `AdminPage`, THE codebase SHALL NOT contain that call after the fix is applied.

---

### Requirement 4: Fix Missing `from` Field in EmailService (BUG-04 — Medium)

**User Story:** As a user, I want to receive transactional emails (password reset, payment confirmation, etc.) that have a valid sender address, so that the emails are not rejected by the mail server.

#### Acceptance Criteria

1. WHEN any `sendMail` call is made inside EmailService, THE EmailService SHALL include a `from` field set to the value of the `emailFrom` config variable (loaded from `EMAIL_FROM` env var).
2. THE EmailService constructor SHALL store `emailFrom` in a private instance field so it is accessible to all methods.
3. THE EmailService SHALL apply the `from` field to all `transporter.sendMail()` calls: `sendPasswordReset`, `sendWithdrawalApproved`, `sendWithdrawalRejected`, `sendPaymentConfirmed`, `sendSoundReviewNotification`, `sendWithdrawalRequested`, `sendSubscriptionExpiring`, `sendQuotaLow`, `sendSoundSold`, and `sendEmailVerification`.

---

### Requirement 5: Fix Non-Functional Resend Button on VerifyEmailPage (BUG-05 — Medium)

**User Story:** As a user who did not receive a verification email, I want the "Kirim ulang" button to actually send a new verification email, so that I can complete my account setup.

#### Acceptance Criteria

1. WHEN a user clicks the "Kirim ulang" button on the email-pending state of `VerifyEmailPage`, THE VerifyEmailPage SHALL call the POST `/auth/resend-verification` API endpoint.
2. WHEN the resend API call succeeds, THE VerifyEmailPage SHALL display a confirmation message indicating the email has been resent.
3. WHEN the resend API call fails, THE VerifyEmailPage SHALL display an error message.
4. WHILE the resend API call is in-flight, THE VerifyEmailPage SHALL disable the "Kirim ulang" button to prevent duplicate submissions.
5. THE button SHALL use the `accessToken` from `useAuthStore()` or the `ApiClient` (which already injects the token via interceptor) for the authenticated POST request.

---

### Requirement 6: Add `totpToken` Field to LoginDto (BUG-06 — Medium)

**User Story:** As a user with 2FA enabled, I want the login endpoint to accept my TOTP token in the DTO, so that TypeScript type-checking is correct and the token is properly validated.

#### Acceptance Criteria

1. THE LoginDto SHALL declare an optional `totpToken` field decorated with `@IsOptional()` and `@IsString()`.
2. WHEN a login request is submitted with a `totpToken` value, THE LoginDto SHALL accept and expose it as a string.
3. WHEN a login request is submitted without a `totpToken` field, THE LoginDto SHALL treat it as `undefined` without throwing a validation error.
4. THE AuthService `login` method signature SHALL change to accept `LoginDto` directly (removing the `& { totpToken?: string }` intersection type) once the field is declared in the DTO.

---

### Requirement 7: Fix `isFree` + `minPrice` Filter Conflict in SoundsService (BUG-07 — Medium)

**User Story:** As a user browsing free sounds, I want filtering by `isFree=true` to return only price=0 sounds regardless of other price filters, so that search results are correct.

#### Acceptance Criteria

1. WHEN `isFree=true` is set in the filter query, THE SoundsService `findAll` method SHALL set `where.price = 0` and SHALL NOT subsequently apply `minPrice` or `maxPrice` conditions to the `where.price` object.
2. WHEN `isFree=false` is explicitly set, THE SoundsService SHALL set `where.price = { gt: 0 }` and SHALL still allow `minPrice`/`maxPrice` to narrow results within that range.
3. WHEN `isFree` is not set, THE SoundsService SHALL apply `minPrice` and `maxPrice` filters independently without interference from the `isFree` branch.
4. WHEN `isFree=true` and `minPrice` are both provided, THE SoundsService SHALL give precedence to `isFree` and SHALL ignore `minPrice` and `maxPrice`.

---

### Requirement 8: Remove Legacy API Client File (DEAD-01)

**User Story:** As a developer maintaining the frontend codebase, I want the duplicate legacy API client removed, so that there is only one canonical import path for HTTP calls.

#### Acceptance Criteria

1. THE file `beathive-frontend/src/lib/api.ts` SHALL be deleted from the repository.
2. WHEN the file is deleted, THE codebase SHALL contain no import statement referencing `@/lib/api` or `../lib/api` that previously resolved to this file.
3. THE canonical API client SHALL remain at `beathive-frontend/src/lib/api/client.ts`.

---

### Requirement 9: Remove Redundant Store Re-export Wrappers (DEAD-02)

**User Story:** As a developer, I want a single canonical import path for Zustand stores, so that there is no ambiguity about which path to use.

#### Acceptance Criteria

1. THE file `beathive-frontend/src/store/auth.store.ts` SHALL be deleted from the repository.
2. THE file `beathive-frontend/src/store/player.store.ts` SHALL be deleted from the repository.
3. WHEN those files are deleted, THE source-of-truth store files at `beathive-frontend/src/lib/store/auth.store.ts` and `beathive-frontend/src/lib/store/player.store.ts` SHALL remain untouched.
4. WHEN the wrapper files are deleted, THE codebase SHALL contain no import statement that previously resolved to `@/store/auth.store` or `@/store/player.store`.

---

### Requirement 10: Remove Unused `buildLicenseText` Method from SoundsController (DEAD-03)

**User Story:** As a developer, I want unused private methods removed from SoundsController, so that the file is smaller and easier to navigate.

#### Acceptance Criteria

1. THE private method `buildLicenseText` in `SoundsController` SHALL be deleted in its entirety (~100 lines).
2. WHEN the method is deleted, THE SoundsController SHALL continue to compile and all existing routes SHALL function without modification.
3. THE codebase SHALL contain no call site that references `buildLicenseText` in `SoundsController` after the deletion.

---

### Requirement 11: Remove Unused `useKeyboardShortcuts` Hook (DEAD-04)

**User Story:** As a developer, I want orphaned hooks removed from the codebase, so that future developers do not mistake them for active code.

#### Acceptance Criteria

1. THE file `beathive-frontend/src/lib/hooks/useKeyboardShortcuts.ts` SHALL be deleted from the repository.
2. WHEN the file is deleted, THE frontend build SHALL succeed without errors.
3. THE codebase SHALL contain no import statement referencing `useKeyboardShortcuts` after the deletion.

> **Note:** If there is a product decision to activate keyboard shortcuts for the player, the hook should be re-implemented and integrated into the player layout component instead of simply restoring this orphaned file.

---

### Requirement 12: Remove Unused `SubscriptionGuard` (DEAD-05)

**User Story:** As a developer, I want unused guards removed from the codebase, so that the guards directory only contains guards that are actually enforced.

#### Acceptance Criteria

1. THE file `beathive-backend/src/common/guards/subscription.guard.ts` SHALL be deleted from the repository.
2. WHEN the guard file is deleted, THE backend SHALL compile successfully and no NestJS module SHALL throw a provider resolution error.
3. THE codebase SHALL contain no `@UseGuards(SubscriptionGuard)` decorator or provider registration referencing `SubscriptionGuard` after the deletion.
4. WHEN the guard is deleted, no existing API endpoint's access-control behavior SHALL change, because the guard was never applied.

---

### Requirement 13: Remove Unused `role` Parameter from Frontend `authApi.register` (DEAD-06)

**User Story:** As a developer, I want the register API helper to match the backend's accepted payload, so that there are no phantom parameters being sent to the server.

#### Acceptance Criteria

1. THE `authApi.register` function in `beathive-frontend/src/lib/api/auth.ts` SHALL remove the optional `role?` parameter from its signature.
2. THE POST body sent to `/auth/register` SHALL contain only `{ name, email, password }`.
3. WHEN `role` is removed, THE `RegisterDto` on the backend SHALL not require any changes, as it already does not accept a `role` field.
4. THE codebase SHALL contain no call site that passes a `role` argument to `authApi.register` after the fix.

---

### Requirement 14: Resolve `isFree` Field in `SoundEffect` Type (DEAD-07 — Corrected)

**User Story:** As a developer, I want the `SoundEffect` TypeScript type to accurately reflect what the backend returns, so that type annotations are trustworthy.

#### Acceptance Criteria

1. THE `SoundEffect` interface in `beathive-frontend/src/types/index.ts` SHALL mark `isFree` as a required `boolean` field (not optional `boolean?`), because `formatSound()` in `SoundsService` always computes and returns `isFree: sound.price === 0`.
2. WHEN the backend's `formatSound()` method returns a sound object, THE response SHALL always include the `isFree` field.

> **Note:** Audit finding DEAD-07 initially flagged `isFree` as dead. Code inspection confirmed that `formatSound()` in `SoundsService` does compute and return `isFree: sound.price === 0` on every response. The corrective action is to strengthen the type from `isFree?: boolean` to `isFree: boolean`, not to remove it.
