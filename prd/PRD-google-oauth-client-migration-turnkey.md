# PRD: Google OAuth Client Migration for Turnkey Login

## 1. Summary

We deleted the existing Google OAuth client used by browser sign-in (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) and need to replace it without losing access to existing Turnkey-backed wallets.

Key risk: creating a new Google OAuth client changes the OIDC audience (`aud`), which can break Turnkey OIDC identity matching for already-onboarded users unless we add a migration path.

## 2. Current Flow in This Repo

- Frontend uses Google Identity Services popup and sends `credential` (OIDC token) to backend.
- Backend resolves Turnkey identity from OIDC token and creates a new sub-org when it cannot find one.

Relevant code:

- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/lib/turnkey-server.ts`

## 3. Google OAuth Console Configuration

For this app's current sign-in integration (GIS popup with token callback), configure the new OAuth client as:

### 3.1 Authorized JavaScript origins

Add:

- `http://localhost:3000`
- `https://<your-production-app-origin>`
- `https://<your-staging-origin>` (if applicable)

Rules:

- Origins only (scheme + host + optional port), no path, no trailing slash.

### 3.2 Authorized redirect URIs

For the current popup/token flow, leave empty.

Notes:

- Redirect URIs are used for server-side OAuth code flows, which this app is not currently using.

## 4. Why Existing Wallets Are At Risk

Current backend lookup starts with `list_suborgs` filtered by the incoming OIDC token. If no match is returned, it creates a brand-new Turnkey sub-org with a new default wallet.

This behavior lives in:

- `apps/web/src/lib/turnkey-server.ts` (`listSubOrgIdsByOidcToken`, `resolveTurnkeyIdentityFromOidcToken`, `createSubOrganizationWithGoogle`)

Result: same email can end up with a new Turnkey identity and new wallets when `aud` changes.

## 5. Migration Requirements

Goal: keep existing users on their original `turnkeySubOrgId` and `turnkeyEndUserId`.

### 5.1 Required backend behavior change

Before creating a new Turnkey sub-org on OIDC miss:

1. Parse verified email from OIDC token.
2. Look up existing app user by email.
3. If app user already has `turnkeySubOrgId`, reuse that sub-org identity path (and do not auto-create a new sub-org).
4. Only create new sub-org if there is no existing app user identity to recover.

### 5.2 Data consistency requirement

Do not create a second `User` record for the same person during migration window. Existing club wallets are tied to old `userId`.

## 6. Rollout Plan

1. Create new Google OAuth client.
2. Add JavaScript origins listed in section 3.
3. Update env var:
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in web runtime/deployment.
4. Deploy backend change from section 5 before broad user re-login.
5. Test with one existing user account and verify:
   - same `User.id`
   - same `turnkeySubOrgId`
   - same wallet access in profile/club flows.
6. Monitor login errors and new user creation metrics for duplicates.

## 7. Validation Checklist

- Existing user signs in and lands on original profile.
- `turnkeySubOrgId` unchanged for migrated user.
- No duplicate `User` row created for same email.
- Existing `ClubWallet` rows continue to work.
- New users still onboard correctly (sub-org auto-creation remains functional for first-time users).

## 8. Rollback

If duplicate identities appear:

1. Temporarily block new social login attempts.
2. Revert to previous login behavior or hotfix to force email->existing-user recovery.
3. Merge duplicate user identities in DB only with explicit mapping and audit trail.
