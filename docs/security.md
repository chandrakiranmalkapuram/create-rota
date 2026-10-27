# Create Rota — Security & Data Isolation Architecture

## 1. Password Hashing & Authentication
- **Algorithm**: Argon2id via `argon2-cffi` (`time_cost=2`, `memory_cost=65536` [64 MB], `parallelism=2`).
- **Session Tokens**: Signed JSON Web Tokens (JWT) using HMAC-SHA256 (`HS256`) with configurable expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Token Invalidation**: Email verification and password reset tokens are single-use (`is_used` boolean flag) and time-limited (`expires_at` UTC timestamp).

## 2. Multi-Tenant Workspace Data Isolation
- **Tenant Model**: Workspaces define hard tenant boundaries. Every user belongs to one or more workspaces with explicit roles (`owner`, `manager`, `viewer`).
- **Authorization Enforcement**: Protected endpoints use the `get_workspace_membership` dependency to verify that the requesting user has an active membership in the target workspace.
- **IDOR Protection**: If a user attempts to access or modify a workspace where they are not a member, the system returns `404 Not Found` (or `403 Forbidden`) with a generic message, preventing both data leaks and tenant existence enumeration.

## 3. Anti-Enumeration & Rate Limiting
- **Anti-Enumeration**:
  - `POST /api/v1/auth/forgot-password`: Always returns a generic response (`"If an account with that email exists, password reset instructions have been sent."`).
  - `POST /api/v1/auth/resend-verification`: Always returns a generic response (`"If an account exists for that email and is unverified, a new verification link has been sent."`).
- **Rate Limiting**: Sliding window in-memory limiter applied to sensitive endpoints:
  - Registration: 10 requests / 5 minutes.
  - Login: 15 attempts / 5 minutes.
  - Verification & Reset requests: 5 requests / 10 minutes.

## 4. Disposable Email Filtering
- Server-side domain validation against a curated, high-confidence list of throwaway email providers (e.g. `mailinator.com`, `10minutemail.com`, `tempmail.com`, `guerrillamail.com`).
- Legitimate corporate and consumer domains (`gmail.com`, `outlook.com`, etc.) are never blocked indiscriminately.
- Validation is implemented behind the `DisposableEmailChecker` interface for extensible domain sources.

## 5. Development Email Sink
- When `EMAIL_PROVIDER=console`, verification and password reset links are printed to the developer console and never exposed in API responses.
- When `EMAIL_PROVIDER=sink`, emails are captured in `memory_email_sink.outbox` for fast automated testing.
