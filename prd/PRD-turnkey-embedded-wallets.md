# PRD: Turnkey Embedded Wallet Migration

## 1. Summary

Replace wallet-auth + user-supplied Polymarket credentials with Turnkey Embedded Wallets and delegated signing so the platform can:

- autonomously execute trades for users,
- maintain clean per-club P&L using wallet-per-user-per-club,
- use Polymarket relayer for gasless flows,
- keep onboarding simple (including normie auth like Google),
- support easy top-up and withdrawal for each club wallet.

Implementation priority: minimize moving parts, minimize custom orchestration code, use strict defaults first.

Authentication direction in this PRD: remove NextAuth/SIWE and use Turnkey as the single authentication system.

## 2. Problem Statement

Current architecture relies on user-managed signing and stored Polymarket API credentials. This causes:

- unreliable server-side signing assumptions,
- fragile automation for trades and order management,
- poor separation for per-club wallet accounting when users join multiple clubs,
- setup friction for non-crypto-native users.

## 3. Goals

1. Autonomous execution: chainworker can place/cancel orders without interactive user signing.
2. Per-club accounting: each user has a distinct wallet per club.
3. Gasless UX: use Polymarket relayer for wallet deploy + execution.
4. Low-friction onboarding: include Google auth path.
5. Simple user money movement: top-up/withdraw per club wallet.
6. Keep implementation simple: strict mode first, fewest entities/endpoints.

## 4. Non-Goals (V1)

- Advanced strategy engine and dynamic risk scoring.
- Multi-party approval workflows beyond strict-mode defaults.
- Cross-chain support beyond Polygon/Polymarket path.
- Real-time websocket infra; polling is acceptable.
- Fiat onramp integration (credit card/bank rails).
- Multiple auth methods beyond Google OAuth.

## 5. Product Principles

- Default to secure, simple behavior over configurability.
- One canonical wallet record per `(user, club)`.
- Treat chainworker as a deterministic executor, not business-logic brain.
- Use policy constraints instead of ad-hoc runtime checks where possible.
- Build strict mode first; add balanced mode later.
- Build strict mode only in MVP.

## 6. Chosen Architecture

### 6.1 Identity and Org Model

- One Turnkey sub-organization per end user.
- One delegated API user per end-user sub-org for chainworker automation.
- Google OAuth is the only login method in MVP.
- App session is managed by first-party server cookies issued after Turnkey auth verification.
- App authorization remains in local DB roles/ownership checks (clubs, memberships, admin actions).

### 6.2 Wallet Model

- One wallet account per `(user, club)` inside user sub-org.
- This wallet is the funder context for that user’s club activity.
- Club-level P&L = sum of ledger activity tied to that club wallet.

### 6.3 Execution Model

- Chainworker signs using delegated API user credentials under Turnkey policies.
- Chainworker uses Polymarket relayer for gasless wallet actions.
- Chainworker uses Polymarket CLOB client for order creation/post/cancel.
- API keys for CLOB are derived/managed server-side per club wallet context (no manual credential input in product UX).

### 6.4 Security Mode for V1

- **Strict Mode (default V1)**:
  - autonomous trade execution allowed,
  - withdrawals require end-user confirmation/signature,
  - no unrestricted backend withdrawal capability.

## 7. User Flows (V1)

### 7.1 Signup / Login

1. User signs up via Turnkey Embedded (Google OAuth).
2. System links Turnkey user/sub-org to local `User`.
3. Session established in app.

### 7.2 Join Club

1. Membership approved.
2. System ensures club wallet exists for `(user, club)`.
3. If missing, synchronously:
   - create wallet account in user sub-org,
   - ensure relayer-compatible setup,
   - persist `ClubWallet` row only after setup succeeds.

### 7.3 Top-up Club Wallet

1. User opens club wallet funding UI.
2. User deposits USDC/USDC.e to club wallet address (or integrated on-ramp later).
3. System refreshes balances + ledger view.

### 7.4 Create Prediction Round

1. Admin creates round.
2. Platform records per-member commit intent.
3. Chainworker executes member orders autonomously via delegated signer + relayer path.

### 7.5 Settle Round

1. Chainworker detects resolution.
2. Applies payout updates and ledger entries.
3. Round + member statuses updated deterministically.

### 7.6 Withdraw (Strict Mode)

1. User requests withdrawal from a specific club wallet.
2. User confirms with interactive Turnkey auth/signing.
3. Transfer executes; ledger updated.

## 8. Data Model Changes (Prisma)

Use minimal schema additions; keep existing tables where possible.

## 8.1 `User` additions

- `turnkeySubOrgId` (string, unique)
- `turnkeyEndUserId` (string, nullable)

## 8.2 New table: `ClubWallet`

Represents one wallet per `(user, club)`.

- `id`
- `userId` (FK)
- `clubId` (FK)
- `walletAddress` (unique)
- `turnkeyWalletAccountId`
- `turnkeyDelegatedUserId`
- `turnkeyPolicyId` (or policy group id)
- `isDisabled` (boolean kill switch)
- `createdAt`, `updatedAt`

Constraints:

- unique `(userId, clubId)`
- index `(clubId, isDisabled)`
- index `(walletAddress)`

## 8.3 Existing model updates

- `LedgerEntry.safeAddress` should reference `ClubWallet.walletAddress` semantically.
- `PredictionRoundMember` execution metadata remains; add `clubWalletId` if needed for direct joins (optional V1).

## 9. API Changes

Deprecate manual Polymarket credential setup endpoints in UI path.

## 9.0 Authentication and Session APIs (replace NextAuth)

- `POST /api/auth/turnkey/login`  
  Verifies Turnkey auth result and issues app session cookie.
- `POST /api/auth/logout`  
  Clears app session cookie.
- `GET /api/auth/session`  
  Returns current app user/session shape for the frontend.

Notes:

- Session cookie is first-party, httpOnly, secure, sameSite-lax.
- Session store can be DB-backed token/session table or signed cookie strategy; pick one and keep it consistent.
- All existing `requireAuth` checks are retained conceptually but reimplemented against app session instead of NextAuth JWT.

## 9.1 New / Updated endpoints

- `POST /api/auth/turnkey/callback` (if required by selected Turnkey auth flow)
- `POST /api/clubs/:slug/wallet/init`  
  Ensures `(user, club)` wallet exists; if missing, performs synchronous provisioning.
- `GET /api/clubs/:slug/wallet`  
  Returns wallet address/balance summary for current user.
- `POST /api/clubs/:slug/wallet/withdraw`  
  Strict mode request requiring user confirmation flow.

## 9.2 Existing endpoint behavior updates

- `POST /api/clubs/:slug/predictions`  
  Validate all active members have a `ClubWallet` row and `isDisabled=false`; otherwise fail fast.
- `GET /api/clubs/:slug/balance` and user balance endpoints  
  Compute from wallet-scoped ledger entries.

## 10. Chainworker Changes

## 10.1 Responsibilities

- Keep polling model.
- For each round member:
  - fetch member `ClubWallet`,
  - sign via Turnkey delegated user,
  - derive/use CLOB api key for that wallet context,
  - post/cancel order through CLOB + relayer as needed.

## 10.2 Required refactor

- Replace global signer key usage with `ClubWallet` scoped Turnkey signing client.
- Remove assumptions that a single signer can act for all members.
- Add per-wallet idempotency keys for retries.

## 10.3 Execution invariants

- Never execute if `ClubWallet` does not exist or `isDisabled=true`.
- Never mark round committed unless every member order is persisted with order id.
- Settlement remains deterministic and idempotent.

## 11. Policy Defaults (Sensible, Simple)

V1 strict defaults:

- Allow delegated signing for:
  - Polymarket order EIP-712 payloads,
  - relayer-required transaction payloads for trading path.
- Deny arbitrary transfers by delegated user.
- Withdrawals require interactive user signer.
- Daily execution cap per club wallet (configurable constant).
- Max order size cap per round member (configurable constant).

Recommended defaults:

- `MAX_ORDER_USDC = 500`
- `MAX_DAILY_EXECUTION_USDC = 2_500`
- `CHAINWORKER_POLL_INTERVAL_MS = 30_000`
- `CHAINWORKER_BATCH_SIZE = 25`

Keep defaults in env + shared config module.

Withdrawal default (MVP):

- Interactive user-confirmed withdrawal only.
- Destination is the user’s primary withdrawal address (single configured address).

## 12. Frontend Changes

## 12.1 Profile page

- Replace legacy wallet/credential setup flow with:
  - account linked status,
  - list of club wallets and balances.

## 12.2 Club page

- Add wallet card for current user in that club:
  - address
  - balance
  - top-up CTA
  - withdraw CTA

## 12.3 Onboarding UX

- Primary CTA: "Continue with Google".

## 12.4 Top-up UX (MVP)

- Show deposit address for each club wallet.
- User funds wallet externally.
- App refreshes displayed balance.

## 12.5 Auth UI/Infra simplification

- Remove NextAuth client/session usage from providers and hooks.
- Remove SIWE sign-in flow.
- Add Turnkey auth client + minimal app session bootstrap call (`/api/auth/session`).
- Keep wallet connection only where needed for user-facing wallet actions, not for primary app login.

## 13. Delivery Plan (Fresh System)

1. Add final schema directly (no compatibility layers).
2. Implement Turnkey auth integration as primary login.
3. Remove NextAuth/SIWE path and replace with first-party app session endpoints.
4. Implement sub-org + delegated user + wallet provisioning service.
5. Refactor chainworker to use Turnkey delegated signing per `ClubWallet`.
6. Implement strict-mode withdrawal confirmation flow.
7. Replace profile/setup UI with club-wallet UX.
8. Remove manual Polymarket credential flow from primary product path.

DB resets are acceptable during development until launch schema is finalized.

## 14. Acceptance Criteria

1. User can sign up/login with Google and access app session.
2. User joining 2 clubs has 2 distinct club wallets.
3. Chainworker can autonomously place orders for READY club wallets.
3. Chainworker can autonomously place orders for enabled `ClubWallet` records.
4. Club P&L remains separated by wallet/club.
5. User can top-up and withdraw from each club wallet.
6. Manual Polymarket credential input is no longer required in primary flow.
7. Strict-mode policy prevents autonomous withdrawals.
8. NextAuth/SIWE is no longer required for authentication.
9. Standard app CRUD authorization (e.g., club/admin settings) works via local DB role checks with Turnkey-authenticated app sessions.
10. Top-up flow works via deposit-address UX without integrated fiat onramp.

## 15. Engineering Plan (Low-Code Bias)

1. Add final schema first.
2. Implement Turnkey auth wrapper + app session issuance + user linking.
3. Replace current auth middleware/helpers (`requireAuth`) to read first-party app session.
4. Remove NextAuth/SIWE providers/hooks/routes.
5. Implement `ClubWallet` provisioning service (single module, idempotent).
6. Refactor chainworker signer abstraction (`SignerProvider`) and swap old global signer path.
7. Replace profile setup UI with club wallet UI.
8. Remove old creds endpoints from primary UI paths.

Keep business rules in small controllers/services and avoid page-level orchestration logic.
