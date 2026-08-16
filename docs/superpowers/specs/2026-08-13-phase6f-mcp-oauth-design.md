# GroceryApp Migration — Phase 6f (MCP OAuth connector) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–7 — complete. The app is **live** on `grocery.thatsmy.app` (main auto-deploys).

## Scope

Let **claude.ai's custom-connector UI** authorize against the MCP server via **OAuth 2.0** (Dynamic
Client Registration + authorization-code + PKCE), in addition to the existing hashed **bearer tokens**
(Claude Desktop/Code). Built on **better-auth's `mcp` plugin** (which wraps its `oidc-provider`) — no
hand-rolled OAuth. All 19 existing MCP tools work unchanged under either auth method.

## Non-goals

No new MCP tools. No change to the bearer-token flow (it keeps working). No custom OAuth crypto — the
plugin owns token issuance, PKCE, and consent storage.

## Architecture

better-auth's `mcp({ loginPage, oidcConfig })` plugin registers the OAuth authorization-server endpoints
under `/api/auth/*` (`/authorize`, `/token`, Dynamic Client Registration, `/oauth2/consent`,
`/mcp/get-session`), storing clients/tokens/consent in the DB. Discovery `.well-known` routes advertise
the server. The MCP route (`/api/mcp`) gains **dual auth**: it validates an OAuth access token first
(`auth.api.getMcpSession`), else falls back to the existing `verifyMcpToken` (manual bearer) — both
resolving to a `householdId` so the tools are scoped identically.

## Components

### 1. Schema — the OIDC tables (migration)

The plugin needs three tables. Generate them canonically with **`npx @better-auth/cli generate`** (reads
the auth config incl. the mcp plugin, emits Prisma models) rather than hand-writing, then add to
`prisma/schema.prisma` and migrate. For reference, the models are:

- **`OauthApplication`** — registered OAuth clients (DCR): `id, name, icon?, metadata?, clientId
  (unique), clientSecret?, redirectUrls, type, disabled (default false), userId? (→User, cascade,
  index), createdAt, updatedAt`.
- **`OauthAccessToken`** — issued tokens: `id, accessToken (unique), refreshToken? (unique),
  accessTokenExpiresAt, refreshTokenExpiresAt?, clientId (→OauthApplication.clientId, cascade, index),
  userId (→User, cascade, index), scopes, createdAt, updatedAt`.
- **`OauthConsent`** — user approvals: `id, clientId (→OauthApplication.clientId, cascade, index),
  userId (→User, cascade, index), scopes, consentGiven (boolean), createdAt, updatedAt`.

Add the matching back-relations on `User` (`oauthApplications`, `oauthAccessTokens`, `oauthConsents`).
Migration `add_oidc_provider`.

### 2. better-auth `mcp` plugin — `src/lib/auth-server.ts`

Add to `betterAuth({ plugins: [...] })` **before** `nextCookies()` (which must stay last):

```ts
mcp({
  loginPage: "/login",
  oidcConfig: {
    allowDynamicClientRegistration: true, // claude.ai self-registers via DCR
    requirePKCE: true,
    consentPage: "/oauth/consent",        // our consent UI (below)
  },
})
```

The plugin auto-adds the OAuth endpoints under `/api/auth/*` and integrates with the existing
better-auth session (the user logs in with their grocery account to authorize).

### 3. Discovery routes — `.well-known/*`

- `src/app/.well-known/oauth-authorization-server/route.ts` → `GET` returns
  `oAuthDiscoveryMetadata(auth)` (advertises `/api/auth/authorize`, `/token`, DCR, PKCE, scopes).
- `src/app/.well-known/oauth-protected-resource/route.ts` → `GET` returns
  `oAuthProtectedResourceMetadata(auth)` (tells claude.ai which authorization server protects
  `/api/mcp`).

(These wrap the better-auth helpers imported from `better-auth/plugins`.)

### 4. MCP route dual auth — `src/app/api/mcp/route.ts`

The existing 5a verify callback (inside `withMcpAuth` from `mcp-handler`) is extended: given the incoming
bearer, first try `auth.api.getMcpSession({ headers: req.headers })` (validates it as an OAuth access
token → `{ userId, … }`); if that returns a session, resolve the user's household
(`householdForUser(userId)`) and return the same `extra: { householdId, userId }` shape the tools already
read. If no OAuth session, fall back to `verifyMcpToken(bearer)` (the existing manual-token path). A
token that matches neither → 401. **No tool code changes** — they still read
`extra.authInfo.extra.householdId`.

`householdForUser(userId)` = a small helper (`prisma.user.findUnique({ where: { id }, select: {
householdId } })`); a user with no household → treat as unauthorized for MCP (no data).

### 5. Consent + login UX

- **`/oauth/consent`** (`src/app/(app)/oauth/consent/page.tsx` + a small client form) — shown during the
  authorize flow: displays the requesting client (name) + the scopes, with **Approve**/**Deny** that POST
  to the plugin's `/api/auth/oauth2/consent` (`{ accept, consent_code }`). Behind the `(app)` auth guard
  so the user is signed in.
- **Login redirect:** during `/authorize`, an unauthenticated user is redirected to `loginPage`
  (`/login`) and back. Confirm `/login` preserves/returns to the OAuth continuation (the plugin manages
  the round-trip; the page may need to honor a `redirect`/callback param).

## Authorization / integrity rules

- OAuth tokens are issued only after the user authenticates with their grocery account **and** consents;
  PKCE is required (`requirePKCE`). Tokens carry a `userId`; the MCP layer maps that to the user's own
  household — a token can only ever reach its owner's household data (same guarantee as the bearer path).
- DCR is enabled so claude.ai can self-register; registered clients live in `OauthApplication`.
- The bearer-token path is unchanged and still household-scoped; the two methods are independent and
  additive.
- OAuth tables cascade on `User` delete.

## Testing

- **Unit:** `householdForUser` is trivial IO; covered by the smoke. (No new pure logic worth a unit test;
  the OAuth crypto is the library's, already tested upstream.)
- **Controller smoke (against a running server + live DB):**
  - `GET /.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` return valid
    JSON metadata (correct issuer/endpoints).
  - **Bearer still works:** the existing 5a/5b tool smoke (a seeded `McpToken` → `tools/list`/`tools/call`)
    still passes — regression check.
  - **OAuth token works:** mint an `OauthAccessToken` for a seeded user+household (via the flow, or a
    direct insert mirroring the plugin) → call `/api/mcp` with it as the bearer → the tools return that
    user's household data. A bad OAuth token → 401.
- **Real end-to-end (user):** add `https://grocery.thatsmy.app/api/mcp` as a **custom connector in
  claude.ai** → it discovers the auth server, registers, the user logs in + consents, and the tools
  appear against their household. (This final client-side step is the user's; the server side is fully
  verified above.)

## Deployment (the app is live)

Build on a **fresh branch off `main`** (`feat/mcp-oauth`). Verify locally (build/tests + the controller
smoke). Then **apply the `add_oidc_provider` migration to the production DB**, and **merge to `main`**
(auto-deploys). Rollback-ready (`vercel rollback` + the migration is additive — new tables only, so it
doesn't affect existing data or the bearer path).

## Verification

`tsc`/`lint`/`vitest`/`build` clean; discovery endpoints valid; bearer regression + OAuth-token smoke
pass; then the live claude.ai connector test. Branch merges to `main` after the prod migration is applied.
