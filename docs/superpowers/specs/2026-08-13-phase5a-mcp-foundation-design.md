# GroceryApp Migration — Phase 5a (MCP foundation + read tools) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–4 — complete & verified.

## Scope

Rebuild the "manage groceries from Claude" MCP server on the new stack, foundation-first: a **token
model + migration**, a **token-management UI** ("Connect to Claude"), the **`/api/mcp`** Streamable-HTTP
endpoint with **hashed-bearer auth** scoping every call to a household, and the **5 read tools**
(`search_items`, `get_lists`, `get_need_to_buy`, `list_tags`, `list_prices`). Ports the Vite app's
`api/mcp.js` + `mcp_tokens` + `McpTokensSection`. **The 13 write tools are Phase 5b.**

## Out of scope (later / 5b)

The **write tools** (add_to_list, mark_list_item, edit_list_item, manage_list, set_stock,
adjust_stock, tag_item, create_item, edit_item, delete_item, log_price, edit_price, delete_price) →
**Phase 5b**. **OAuth** connector support (claude.ai custom-connector UI) → **deferred** (bearer works
with Claude Desktop / Claude Code). No new tools beyond parity.

## Architecture & the transport decision

MCP tools are **token-authed, not session-authed** — so they can't use the session-based
`requireHousehold()`. Instead, the bearer token resolves a `householdId`, and tools call a
**household-scoped query layer** (`src/lib/mcp-queries.ts`) taking an explicit `householdId`. Pure
helpers (`computeNeedToBuy`, `cheapestByItem`) are reused.

**Transport (the main technical risk):** the MCP SDK's `StreamableHTTPServerTransport` targets Node
`req/res`, but Next.js App Router route handlers use the Web `Request/Response` API. The chosen
bridge is the **`mcp-handler`** package (Vercel's official Next.js MCP adapter) in **stateless**
mode, with its `withMcpAuth` wrapper for bearer auth. **Prototype-first:** the implementation's first
step stands up a minimal `/api/mcp` (one trivial tool, no auth) and verifies an MCP `initialize` +
`tools/list` round-trip (via `curl` JSON-RPC or an MCP client) BEFORE any real tools are built — the
transport gates everything, so we de-risk it up front. If `mcp-handler` proves unworkable in this
Next version, the fallback is handling the MCP JSON-RPC directly in the route handler (documented in
the plan).

## Data model

**Schema change (new table) + migration** — the first phase since Phase 1's init to touch the schema:
- **McpToken**: `id, tokenHash (unique), householdId, userId, name?, lastFour?, createdAt, lastUsedAt?`.
  FK `household`/`user` `onDelete: Cascade`. Relations added to `Household` and `User`. Raw tokens are
  **never stored** — only the SHA-256 hash + the last 4 chars for display.
- Requires `npx prisma migrate dev --name add_mcp_tokens` against the live Prisma Postgres (the
  controller runs it, same as Phase 1's init).

## Components

### 1. Token lib — `src/lib/mcp-token.ts`

Pure/DB helpers:
- `generateRawToken(): string` — e.g. `grocery_<32 url-safe random bytes>` (via `node:crypto`).
- `hashToken(raw: string): string` — SHA-256 hex. **Pure, unit-tested** (same input → same hash;
  different input → different hash).
- `lastFour(raw: string): string`.
- `createMcpToken(userId, householdId, name)` — generates a raw token, stores its hash + lastFour +
  name, returns `{ raw, id }` (raw shown once, never persisted).
- `verifyMcpToken(rawBearer): { householdId, userId, tokenId } | null` — hashes the bearer, looks up
  the `McpToken`, returns its household/user (updates `lastUsedAt` best-effort), else null.
- `listMcpTokens(userId)` / `revokeMcpToken(id, userId)` — user-scoped metadata list + delete (never
  exposes the hash).

### 2. Token-management UI — `/settings` page + `McpTokensCard`

- A new **`/settings`** page (under the `(app)` guard) reachable from the app nav, with a
  **"Connect to Claude"** card:
  - Lists the user's tokens (name, last-four, created, last-used) with **Revoke**.
  - A **Generate token** button (name input) → server action `createMcpToken` → shows the **raw token
    once** with a copy affordance and a note it won't be shown again.
  - Static **connection instructions** (the `/api/mcp` URL + a Claude Desktop JSON config snippet
    with the `Authorization: Bearer <token>` header), adapted from the Vite README.
- Server actions `generateMcpToken({ name })` and `revokeMcpTokenAction(id)` wrap the lib, scoped to
  the current session user (`requireUser()`).

### 3. `/api/mcp` route — `src/app/api/mcp/route.ts`

- Built with `mcp-handler`'s `createMcpHandler(server => { /* register read tools */ }, …)` +
  `withMcpAuth(handler, verify, { required: true })`, exported as `GET`/`POST` (+ `OPTIONS` if needed).
- `verify(req, bearer)` calls `verifyMcpToken(bearer)`; on success returns auth info carrying
  `householdId` (in `extra`); on failure returns undefined → 401. Every tool reads `householdId` from
  the auth context and passes it to the query layer.

### 4. Household-scoped read queries — `src/lib/mcp-queries.ts`

Plain Prisma functions taking an explicit `householdId` (no session):
- `searchItems(householdId, query, limit)` — items by name/nameHe ilike.
- `getLists(householdId, status?)` — lists (with items) filtered by status (open/all).
- `getNeedToBuy(householdId)` — reuses `computeNeedToBuy` over the household's stock + open-list items.
- `listTags(householdId, type?)` — tags with item counts.
- `listPrices(householdId, itemId?)` — price history (or cheapest per item), Decimal→number.

### 5. The 5 read tools

Each `server.tool(name, description, zodInputSchema, handler)`; the handler reads `householdId` from
auth, calls the matching `mcp-queries` function, and returns MCP content (concise text or JSON):
`search_items`, `get_lists`, `get_need_to_buy`, `list_tags`, `list_prices`.

### 6. i18n

Add a `settings` i18n group (+ `catalog.nav.settings` or a nav entry) to both dictionaries for the
Connect-to-Claude UI. (Tool descriptions returned to Claude are English strings in the route, not i18n.)

## Authorization / integrity rules

- **Raw tokens are never stored** (only SHA-256 hash + last-four). `verifyMcpToken` is the only path
  that resolves a household from a bearer; a bad/unknown token → 401, no data.
- Every MCP query is scoped by the token's `householdId` — a token can only ever read its own
  household's data. `mcp-queries` functions take `householdId` explicitly and always filter by it.
- Token management (list/generate/revoke) is scoped to the session user (`requireUser()`); the UI
  never exposes a hash, and the raw token is shown exactly once at creation.

## Testing

- Unit-test the pure token helpers (`hashToken` determinism + collision-avoidance, `lastFour`,
  `generateRawToken` shape).
- The transport/auth/tools are verified by build/typecheck + lint + a manual smoke test: generate a
  token in `/settings`; hit `/api/mcp` with `curl` (JSON-RPC `initialize` then `tools/list` →
  the 5 tools; then `tools/call` `get_need_to_buy`/`search_items` with the bearer → correct
  household-scoped data); a bad bearer → 401; a token for another household can't read this one's
  data. Against the live Prisma Postgres.

## Verification

Manual smoke test on `npm run dev`: `/settings` → generate a token (copy it); `curl -H "Authorization:
Bearer <token>" -H "Content-Type: application/json" -d '{jsonrpc:2.0, method:tools/list, ...}'
http://localhost:3001/api/mcp` returns the 5 read tools; `tools/call search_items {query:"milk"}`
returns the household's matching items; an invalid bearer returns 401; revoke the token → subsequent
calls 401. Clean up.
