# GroceryApp Phase 6f — MCP OAuth Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support claude.ai's custom-connector OAuth flow against `/api/mcp` (via better-auth's `mcp` plugin), coexisting with the existing bearer-token path.

**Architecture:** Add better-auth's `mcp`/`oidc-provider` (3 DB tables + `/api/auth/*` OAuth endpoints), publish `.well-known` discovery routes, and extend the MCP route's verify to accept OAuth access tokens (→ user → household) OR the existing manual bearer. No MCP tool changes.

**Tech Stack:** Next.js 16, better-auth (`mcp` plugin), Prisma 6, `mcp-handler`, TypeScript.

## Global Constraints

- Branch **`feat/mcp-oauth`** (off `main` — the live branch), never commit to `main` directly. Personal git identity. Never commit `.env`.
- Lint is **`npm run lint`**. `Result` types + existing MCP tool structure unchanged.
- The **bearer-token path stays working** (regression-check it). OAuth is additive.
- The OIDC migration is **additive** (new tables only) — safe to apply to the live prod DB.
- **External-API discipline:** better-auth's `mcp` plugin owns the OAuth flow. Where this plan gives exact code, use it; where it flags "confirm against installed better-auth" (endpoint names, `getMcpSession`/session shape, the consent-page params), read the installed `node_modules/better-auth/dist/plugins/mcp` + `oidc-provider` types and adapt. Document what you used.

## Prisma-adapter naming note

better-auth accesses its models as `prisma.<camelCaseModelName>` (e.g. `prisma.oauthApplication`). So the
Prisma models below are named `OauthApplication`/`OauthAccessToken`/`OauthConsent` (PascalCase → the
camelCase client accessor better-auth expects) — no `@@map` needed, matching how `User`/`Session`/`Account`
already work.

---

## Task 1: OIDC schema (3 tables) + migration

**Files:** Modify `prisma/schema.prisma`.

**Interfaces — Produces:** `prisma.oauthApplication` / `prisma.oauthAccessToken` / `prisma.oauthConsent`.

- [ ] **Step 1: Add the models + back-relations**

Append to `prisma/schema.prisma`:

```prisma
model OauthApplication {
  id           String   @id @default(cuid())
  name         String
  icon         String?
  metadata     String?
  clientId     String   @unique
  clientSecret String?
  redirectUrls String
  type         String
  disabled     Boolean  @default(false)
  userId       String?
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  accessTokens OauthAccessToken[]
  consents     OauthConsent[]

  @@index([userId])
  @@index([clientId])
}

model OauthAccessToken {
  id                    String    @id @default(cuid())
  accessToken           String    @unique
  refreshToken          String?   @unique
  accessTokenExpiresAt  DateTime
  refreshTokenExpiresAt DateTime?
  clientId              String
  client                OauthApplication @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  scopes                String
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([clientId])
  @@index([userId])
}

model OauthConsent {
  id           String   @id @default(cuid())
  clientId     String
  client       OauthApplication @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  scopes       String
  consentGiven Boolean
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([clientId])
  @@index([userId])
}
```

Add three back-relation lines inside `model User { ... }`: `oauthApplications OauthApplication[]`,
`oauthAccessTokens OauthAccessToken[]`, `oauthConsents OauthConsent[]`.

- [ ] **Step 2: Validate + generate**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx prisma validate && npx prisma generate`
Expected: valid; client generated (`prisma.oauthApplication` etc. typed).

> **Cross-check (recommended):** run `npx @better-auth/cli@latest generate` (after Task 2 adds the plugin) and diff its emitted models against the above — if better-auth expects extra/renamed fields for this version, reconcile. The hand-written models match the installed `oidc-provider/schema` field list; a mismatch here would surface as a runtime adapter error in the smoke.

> **Migration:** the controller runs `npx prisma migrate dev --name add_oidc_provider` (local) and `prisma migrate deploy` against prod. Do NOT run migrate here.

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add prisma/schema.prisma
git commit -m "feat(oauth): OIDC provider tables (oauthApplication/accessToken/consent)"
```

---

## Task 2: better-auth `mcp` plugin

**Files:** Modify `src/lib/auth-server.ts`.

**Interfaces — Produces:** the OAuth endpoints under `/api/auth/*` (`/authorize`, `/token`, DCR, `/oauth2/consent`, `/mcp/get-session`).

- [ ] **Step 1: Add the plugin**

In `src/lib/auth-server.ts`, import `mcp` and add it to the `plugins` array **before** `nextCookies()`
(which MUST stay last):

```ts
import { mcp } from "better-auth/plugins";
// ...
plugins: [
  emailOTP({ /* unchanged */ }),
  mcp({
    loginPage: "/login",
    oidcConfig: {
      allowDynamicClientRegistration: true, // claude.ai self-registers
      requirePKCE: true,
      consentPage: "/oauth/consent",
    },
  }),
  nextCookies(), // MUST stay last
],
```

> Confirm the `mcp` import path (`better-auth/plugins`) and the `MCPOptions`/`OIDCOptions` field names
> (`loginPage`, `oidcConfig`, `allowDynamicClientRegistration`, `requirePKCE`, `consentPage`) against the
> installed `node_modules/better-auth/dist/plugins/mcp` + `oidc-provider` types; adjust if they differ.

- [ ] **Step 2: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean; builds (the plugin + its `/api/auth/*` routes compile). (Runtime needs Task 1's migration, applied by the controller.)

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/auth-server.ts
git commit -m "feat(oauth): enable better-auth mcp plugin (OAuth authorization server)"
```

---

## Task 3: `.well-known` discovery routes

**Files:** Create `src/app/.well-known/oauth-authorization-server/route.ts`, `src/app/.well-known/oauth-protected-resource/route.ts`.

**Interfaces — Consumes:** `oAuthDiscoveryMetadata` / `oAuthProtectedResourceMetadata` from `better-auth/plugins`; `auth` from `@/lib/auth-server`.

- [ ] **Step 1: Authorization-server metadata**

Create `src/app/.well-known/oauth-authorization-server/route.ts`:

```ts
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth-server";

export const GET = oAuthDiscoveryMetadata(auth);
```

- [ ] **Step 2: Protected-resource metadata**

Create `src/app/.well-known/oauth-protected-resource/route.ts`:

```ts
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth-server";

export const GET = oAuthProtectedResourceMetadata(auth);
```

> Confirm both helpers are exported from `better-auth/plugins` and that they return a Next-compatible
> `GET` handler (they wrap the auth instance). If the signature differs (e.g. needs `(req)` or returns
> metadata to wrap in `NextResponse.json`), adapt per the installed types. The `/api/mcp`
> resource/authorization-server URLs in the output should be `https://grocery.thatsmy.app/...` in prod
> (derived from `BETTER_AUTH_URL`).

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/.well-known
git commit -m "feat(oauth): OAuth discovery metadata (.well-known) routes"
```

---

## Task 4: MCP route dual auth (OAuth token + bearer)

**Files:** Modify `src/app/api/mcp/route.ts`.

**Interfaces — Consumes:** `auth` from `@/lib/auth-server`; `prisma`; existing `verifyMcpToken`.

- [ ] **Step 1: Add the household-for-user helper + OAuth check in verify**

In `src/app/api/mcp/route.ts`, add imports (`auth`, `prisma`) and a helper, then extend the
`withMcpAuth(...)` verify callback so it tries an OAuth access token first, then the manual bearer:

```ts
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

async function householdForUser(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
  return u?.householdId ?? null;
}
```

Replace the verify callback body with:

```ts
async (req: Request, bearer?: string) => {
  // 1. OAuth access token (claude.ai custom connector)
  try {
    const session = await auth.api.getMcpSession({ headers: req.headers });
    if (session?.userId) {
      const householdId = await householdForUser(session.userId);
      if (householdId) {
        return {
          token: bearer ?? "oauth",
          scopes: typeof session.scopes === "string" ? session.scopes.split(" ") : [],
          clientId: session.clientId ?? "oauth",
          extra: { householdId, userId: session.userId },
        };
      }
    }
  } catch {
    // not an OAuth token / no session — fall through to the manual bearer
  }
  // 2. Manual hashed bearer (Claude Desktop/Code — existing 5a path)
  if (!bearer) return undefined;
  const v = await verifyMcpToken(bearer);
  if (!v) return undefined;
  return { token: bearer, scopes: [], clientId: v.tokenId, extra: { householdId: v.householdId, userId: v.userId } };
}
```

> Confirm `auth.api.getMcpSession({ headers })` is the correct call + the returned `OAuthAccessToken`
> field names (`userId`, `scopes`, `clientId`) against the installed `mcp` plugin types; adapt if they
> differ. The tools are UNCHANGED — they still read `extra.authInfo.extra.householdId`.

- [ ] **Step 2: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): accept OAuth access tokens alongside manual bearer tokens"
```

---

## Task 5: Consent page + login round-trip

**Files:** Create `src/app/(app)/oauth/consent/page.tsx` (+ a client form component if needed); verify `/login` honors the OAuth continuation.

**Interfaces — Consumes:** the plugin's `/api/auth/oauth2/consent` endpoint (`{ accept: boolean, consent_code?: string }`).

- [ ] **Step 1: Consent page**

Create `src/app/(app)/oauth/consent/page.tsx` — behind the `(app)` auth guard (so the user is signed in).
Read the OAuth request params the plugin passes to `consentPage` (from `searchParams` — e.g. `client_id`,
`scope`, `consent_code`), display the requesting connector name + scopes, and render **Approve** / **Deny**
that POST to `/api/auth/oauth2/consent` with `{ accept: true|false, consent_code }`, then redirect back to
continue the flow.

> **Confirm the exact consent contract against the installed plugin:** read
> `node_modules/better-auth/dist/plugins/oidc-provider/authorize.mjs` (or the mcp plugin) to see (a) which
> query params it redirects to `consentPage` with, and (b) the exact `/oauth2/consent` request body +
> success redirect. Build the page to that contract. If the plugin renders its own default consent, this
> page may only need to relay the params — implement the minimal correct version.

Add any needed i18n strings to both dictionaries (`oauth.consent.*`) with `he: typeof en` parity.

- [ ] **Step 2: Login round-trip**

Confirm the `/login` flow returns the user to the in-progress OAuth authorization after sign-in (the
plugin appends a return/callback param when redirecting an unauthenticated user to `loginPage`). If the
login action ignores a return URL, thread it through so authorize resumes. (Read how the plugin invokes
`loginPage`; adjust `/login` minimally if required.)

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean; builds.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/\(app\)/oauth src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(oauth): consent page + login round-trip for the authorize flow"
```

---

## Verification (controller-run — needs the live DB; deploys to prod)

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` all clean.

- [ ] **2. Migration (local):** `npx prisma migrate dev --name add_oidc_provider`; commit the migration.

- [ ] **3. Controller smoke** (`PORT=3001 npm run dev`):
  - `GET /.well-known/oauth-authorization-server` + `/.well-known/oauth-protected-resource` → valid JSON
    with the expected issuer/endpoints.
  - **Bearer regression:** the 5a/5b tool smoke (seed household + `McpToken`) → `tools/list` + a
    `tools/call` still return that household's data (the manual path is intact).
  - **OAuth-token path:** create an `OauthApplication` + `OauthAccessToken` for a seeded user+household
    (via the flow, or a direct insert mirroring the plugin's token shape) → call `/api/mcp` with it as the
    bearer → tools return that user's household data; a bad/expired token → 401.
  - Clean up seeded rows.

- [ ] **4. Deploy:** apply the migration to **prod** (`prisma migrate deploy` with the prod `DATABASE_URL`),
  push `feat/mcp-oauth`, do the **final whole-branch review**, then **merge to `main`** (auto-deploys).
  Re-check the live `.well-known` endpoints on `grocery.thatsmy.app`. Rollback-ready.

- [ ] **5. Real end-to-end (user):** the user adds `https://grocery.thatsmy.app/api/mcp` as a **custom
  connector in claude.ai** → DCR + login + consent → the tools appear against their household.

---

## Self-Review

**Spec coverage:** OIDC tables + migration ✓ (Task 1); `mcp` plugin (DCR + PKCE + consentPage) ✓ (Task 2);
`.well-known` discovery routes ✓ (Task 3); MCP dual-auth (OAuth token → household, else bearer;
tools unchanged) ✓ (Task 4); consent page + login round-trip ✓ (Task 5); bearer regression + OAuth smoke +
live deploy + the user's claude.ai connect ✓ (verification). Household-scoping preserved (OAuth token →
its own user's household only) ✓.

**Placeholder scan:** No TBD/TODO. The several "confirm against installed better-auth" notes are bounded
external-API instructions (as used for `mcp-handler`/`@vercel/blob` in prior phases) — the library owns the
OAuth flow specifics; each names the exact file/types to check and is resolved during that task's build.

**Type consistency:** `householdForUser(userId): Promise<string | null>` used in the verify; the OAuth
branch returns the same `extra: { householdId, userId }` shape the manual branch and all tools already use.
Prisma models named PascalCase → `prisma.oauthApplication` etc. matches better-auth's modelName accessors;
relations reference `OauthApplication.clientId` (a `@unique` field) with cascades; `User` gains the three
back-relations. The `mcp` plugin sits before `nextCookies()` (kept last).
