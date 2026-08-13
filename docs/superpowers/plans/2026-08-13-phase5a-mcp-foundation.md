# GroceryApp Phase 5a — MCP Foundation + Read Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a token-authed MCP server at `/api/mcp` exposing 5 read tools scoped to a household, plus a "Connect to Claude" settings UI to generate/revoke bearer tokens.

**Architecture:** A new `McpToken` table stores a SHA-256 hash of each bearer (raw shown once). The `/api/mcp` route uses the `mcp-handler` adapter (Vercel's Next.js MCP bridge) in stateless mode; its `withMcpAuth` wrapper hashes the incoming bearer, looks up the token, and resolves a `householdId` into the tool call context. Tools call a household-scoped query layer (`mcp-queries.ts`) that takes an explicit `householdId` — never the session-based `requireHousehold()`, since MCP calls have no session.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + Prisma Postgres, `@modelcontextprotocol/sdk` via `mcp-handler`, Zod 4, Vitest 4, better-auth (session for the settings UI only), Tailwind v4.

## Global Constraints

- Personal git identity only (GroceryApp local config): `sharifshayma` / personal email. Never commit `.env`.
- Never touch `main`. All work on branch `next-migration`.
- Action results: `{ ok: true; ... } | { ok: false; error: string }`. Server actions are `"use server"`.
- Raw tokens are **never persisted** — only `tokenHash` (SHA-256 hex) + `lastFour`. The raw token is shown exactly once, at creation.
- Every MCP data read is scoped by the token's `householdId`. `mcp-queries` functions take `householdId` as their first parameter and always filter by it. No unscoped Prisma reads.
- i18n: `he: typeof en` parity must hold — every key added to `en.ts` must be added to `he.ts`.
- Prisma `Decimal` (price) → `Number(...)` before crossing any RSC/serialization boundary.
- Tool descriptions/inputs returned to Claude are plain English strings in the route (not i18n).

---

## File Structure

- `prisma/schema.prisma` — add `model McpToken` + relations on `Household`/`User` (Task 1).
- `src/lib/mcp-token.ts` — token generate/hash/create/verify/list/revoke (Task 2).
- `src/lib/mcp-token.test.ts` — unit tests for the pure helpers (Task 2).
- `src/actions/mcp-tokens.ts` — `generateMcpToken` / `revokeMcpTokenAction` server actions (Task 2).
- `src/app/api/mcp/route.ts` — the MCP endpoint: transport (Task 3) → auth (Task 4) → tools (Task 6).
- `src/lib/mcp-queries.ts` — household-scoped read queries (Task 5).
- `src/lib/mcp-queries.test.ts` — unit test for the one pure-ish shaping helper (Task 5).
- `src/app/(app)/settings/page.tsx` + `src/components/McpTokensCard.tsx` — Connect-to-Claude UI (Task 7).
- `src/app/(app)/layout.tsx` — add a Settings nav link (Task 7).
- `src/i18n/dictionaries/{en,he}.ts` — `settings` group + `catalog.nav.settings` (Task 7).

---

## Task 1: McpToken schema + relations

**Files:**
- Modify: `prisma/schema.prisma` (add model + two relations)

**Interfaces:**
- Produces: `McpToken` model with fields `id, tokenHash (unique), householdId, userId, name?, lastFour?, createdAt, lastUsedAt?`; Prisma client accessor `prisma.mcpToken`; compound nothing (single-column unique on `tokenHash`).

- [ ] **Step 1: Add the model + relations**

Add to `prisma/schema.prisma`:

```prisma
model McpToken {
  id          String    @id @default(cuid())
  tokenHash   String    @unique
  householdId String
  userId      String
  name        String?
  lastFour    String?
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?

  household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([householdId])
  @@index([userId])
}
```

Add the back-relations to the existing models (add one line inside each model body, alongside its other relations):
- In `model Household { ... }`: `mcpTokens McpToken[]`
- In `model User { ... }`: `mcpTokens McpToken[]`

- [ ] **Step 2: Validate the schema**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

- [ ] **Step 3: Generate the client (no DB needed)**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx prisma generate`
Expected: "Generated Prisma Client" — `prisma.mcpToken` now typed.

> **Note (controller runs the migration):** Do NOT run `prisma migrate dev` here — it needs the live DB and is run by the controller during verification (`npx prisma migrate dev --name add_mcp_tokens`). `prisma generate` above is enough for the code in later tasks to typecheck.

- [ ] **Step 4: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add prisma/schema.prisma
git commit -m "feat(mcp): add McpToken model for bearer-token auth"
```

---

## Task 2: Token library + server actions

**Files:**
- Create: `src/lib/mcp-token.ts`
- Create: `src/lib/mcp-token.test.ts`
- Create: `src/actions/mcp-tokens.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`; `requireUser` from `@/lib/auth-guard`; `requireHousehold` from `@/lib/household-context`.
- Produces:
  - `generateRawToken(): string`
  - `hashToken(raw: string): string`
  - `lastFour(raw: string): string`
  - `createMcpToken(userId: string, householdId: string, name: string | null): Promise<{ raw: string; id: string }>`
  - `verifyMcpToken(rawBearer: string): Promise<{ householdId: string; userId: string; tokenId: string } | null>`
  - `listMcpTokens(userId: string): Promise<{ id: string; name: string | null; lastFour: string | null; createdAt: Date; lastUsedAt: Date | null }[]>`
  - `revokeMcpToken(id: string, userId: string): Promise<boolean>`
  - actions: `generateMcpToken({ name }: { name: string }): Promise<{ ok: true; raw: string } | { ok: false; error: string }>`; `revokeMcpTokenAction(id: string): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mcp-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateRawToken, hashToken, lastFour } from "./mcp-token";

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashToken("grocery_abc")).toBe(hashToken("grocery_abc"));
  });
  it("differs for different inputs", () => {
    expect(hashToken("grocery_abc")).not.toBe(hashToken("grocery_abd"));
  });
  it("returns a 64-char hex string (sha256)", () => {
    expect(hashToken("grocery_abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateRawToken", () => {
  it("has the grocery_ prefix and is long", () => {
    const t = generateRawToken();
    expect(t.startsWith("grocery_")).toBe(true);
    expect(t.length).toBeGreaterThan(24);
  });
  it("is unique across calls", () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe("lastFour", () => {
  it("returns the last four chars", () => {
    expect(lastFour("grocery_abcdef")).toBe("cdef");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mcp-token.test.ts`
Expected: FAIL — cannot resolve `./mcp-token`.

- [ ] **Step 3: Write the library**

Create `src/lib/mcp-token.ts`:

```ts
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function generateRawToken(): string {
  return "grocery_" + randomBytes(24).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function lastFour(raw: string): string {
  return raw.slice(-4);
}

export async function createMcpToken(
  userId: string,
  householdId: string,
  name: string | null,
): Promise<{ raw: string; id: string }> {
  const raw = generateRawToken();
  const row = await prisma.mcpToken.create({
    data: {
      tokenHash: hashToken(raw),
      householdId,
      userId,
      name: name?.trim() || null,
      lastFour: lastFour(raw),
    },
    select: { id: true },
  });
  return { raw, id: row.id };
}

export async function verifyMcpToken(
  rawBearer: string,
): Promise<{ householdId: string; userId: string; tokenId: string } | null> {
  const trimmed = rawBearer.trim();
  if (!trimmed) return null;
  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(trimmed) },
    select: { id: true, householdId: true, userId: true },
  });
  if (!row) return null;
  // best-effort last-used update; never block the request on it
  void prisma.mcpToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { householdId: row.householdId, userId: row.userId, tokenId: row.id };
}

export async function listMcpTokens(userId: string) {
  return prisma.mcpToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, lastFour: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeMcpToken(id: string, userId: string): Promise<boolean> {
  const res = await prisma.mcpToken.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mcp-token.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Write the server actions**

Create `src/actions/mcp-tokens.ts`:

```ts
"use server";

import { requireUser } from "@/lib/auth-guard";
import { requireHousehold } from "@/lib/household-context";
import { createMcpToken, revokeMcpToken } from "@/lib/mcp-token";

export async function generateMcpToken({
  name,
}: {
  name: string;
}): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const household = await requireHousehold();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name is required" };
  if (clean.length > 60) return { ok: false, error: "Name is too long" };
  const { raw } = await createMcpToken(user.id, household.id, clean);
  return { ok: true, raw };
}

export async function revokeMcpTokenAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ok = await revokeMcpToken(id, user.id);
  if (!ok) return { ok: false, error: "Token not found" };
  return { ok: true };
}
```

> **Check `requireHousehold`'s return shape:** this plan assumes `requireHousehold()` resolves to an object with an `.id`. Confirm against `src/lib/household-context.ts` and adjust the `.id` access if the field differs.

- [ ] **Step 6: Typecheck + lint**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npx next lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mcp-token.ts src/lib/mcp-token.test.ts src/actions/mcp-tokens.ts
git commit -m "feat(mcp): token lib (hash/create/verify/revoke) + settings actions"
```

---

## Task 3: Transport spike — minimal `/api/mcp` (no auth)

**This task de-risks the transport before any real tool is built.** Get an MCP client to complete `initialize` + `tools/list` against the Next route, or stop and switch to the fallback.

**Files:**
- Modify: `package.json` (add `mcp-handler`)
- Create: `src/app/api/mcp/route.ts`

**Interfaces:**
- Produces: a route exporting `GET`/`POST` (+ `OPTIONS` if the adapter needs it) that serves an MCP server named `grocery`. Later tasks replace the single spike tool with real tools and wrap the handler in auth.

- [ ] **Step 1: Install the adapter**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm install mcp-handler @modelcontextprotocol/sdk`
Expected: both added to `dependencies`. (`mcp-handler` needs `@modelcontextprotocol/sdk` + `zod` as peers; `zod` is already present.)

- [ ] **Step 2: Read the installed adapter's real API**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && cat node_modules/mcp-handler/README.md 2>/dev/null | head -120; echo '--- types ---'; find node_modules/mcp-handler/dist -name '*.d.ts' | head; sed -n '1,80p' node_modules/mcp-handler/dist/index.d.ts 2>/dev/null`

Note the exact exported names and signatures — expected: `createMcpHandler(setup, serverOptions?, config?)` returning a `(req: Request) => Promise<Response>` handler, and `withMcpAuth(handler, verifyToken, options?)`. **In your task report, record the exact signatures you used** so Tasks 4 and 6 match them. If the exports differ from what this plan assumes, adapt the code below to the installed API (that is expected and fine).

- [ ] **Step 3: Write the minimal route (one tool, no auth)**

Create `src/app/api/mcp/route.ts`:

```ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "ping",
      "Health check — returns pong.",
      { echo: z.string().optional() },
      async ({ echo }) => ({
        content: [{ type: "text", text: echo ? `pong: ${echo}` : "pong" }],
      }),
    );
  },
  {
    // server info
    serverInfo: { name: "grocery", version: "1.0.0" },
  },
  {
    // adapter config — stateless HTTP, mounted at /api/mcp
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST };
```

> If Step 2 shows a different option shape (e.g. `serverInfo` belongs in a different arg, or `basePath` must be `/api/mcp`), use the installed shape. The invariant: the MCP server is named `grocery` and is reachable at `POST /api/mcp`.

- [ ] **Step 4: Typecheck**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Self-verify the transport round-trip (server + curl in one shell)**

Run this as a single command (starts the dev server on 3001, waits, does an MCP `initialize` then `tools/list`, then kills the server):

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp && \
( PORT=3001 npm run dev >/tmp/mcp-spike.log 2>&1 & echo $! > /tmp/mcp-spike.pid ) && \
sleep 9 && \
echo "=== initialize ===" && \
curl -s -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}' ; \
echo && echo "=== tools/list ===" && \
curl -s -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' ; \
echo && kill "$(cat /tmp/mcp-spike.pid)" 2>/dev/null
```

Expected: the `initialize` response includes `"serverInfo":{"name":"grocery"...}`; the `tools/list` response lists the `ping` tool. Responses may be `text/event-stream` (`data: {...}`) rather than plain JSON — that's fine; look for the JSON payload inside.

> **If this fails** (e.g. the adapter can't run in this Next version, or requires a session/Redis you can't satisfy stateless): STOP and report it. The documented fallback is to implement the JSON-RPC directly in the route handler — parse the POST body, handle `initialize`/`tools/list`/`tools/call`, dispatch to tool functions, return JSON. Do not spend more than one debugging pass on the adapter before falling back; capture the error in your report so the controller can decide.

- [ ] **Step 6: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add package.json package-lock.json src/app/api/mcp/route.ts
git commit -m "feat(mcp): transport spike — /api/mcp serves a ping tool via mcp-handler"
```

---

## Task 4: Bearer auth on `/api/mcp`

**Files:**
- Modify: `src/app/api/mcp/route.ts`

**Interfaces:**
- Consumes: `verifyMcpToken` from `@/lib/mcp-token` (Task 2); the adapter's `withMcpAuth` (verified shape from Task 3, Step 2).
- Produces: the exported `GET`/`POST` are now the auth-wrapped handler; on success the tool call context carries `householdId` + `userId`. A request with a missing/invalid bearer gets a 401.

- [ ] **Step 1: Wrap the handler with auth**

Modify `src/app/api/mcp/route.ts` — keep the `createMcpHandler(...)` call, but rename its result to `baseHandler` and wrap it. The tool handler now reads the household from the auth context (the `ping` tool can stay for now; Task 6 replaces the tool set):

```ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "ping",
      "Health check — returns pong.",
      { echo: z.string().optional() },
      async ({ echo }, extra) => {
        const householdId = extra?.authInfo?.extra?.householdId as string | undefined;
        return {
          content: [
            { type: "text", text: `${echo ? `pong: ${echo}` : "pong"} (household ${householdId ?? "?"})` },
          ],
        };
      },
    );
  },
  { serverInfo: { name: "grocery", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: true },
);

const authedHandler = withMcpAuth(
  baseHandler,
  async (_req: Request, bearer?: string) => {
    if (!bearer) return undefined;
    const v = await verifyMcpToken(bearer);
    if (!v) return undefined;
    return {
      token: bearer,
      scopes: [],
      clientId: v.tokenId,
      extra: { householdId: v.householdId, userId: v.userId },
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
```

> Match `withMcpAuth`'s real signature + the `AuthInfo` return shape from Task 3, Step 2 (fields are typically `token`, `scopes`, `clientId`, `expiresAt?`, `extra?`). How a tool reads it (`extra.authInfo.extra` vs `extra.authInfo`) also comes from that inspection — adjust the `householdId` read accordingly and keep it consistent for Task 6.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Self-verify a bad bearer is rejected (offline, no DB row needed)**

A bad token still hits the DB (lookup returns null → 401). This needs the DB, so it is folded into the **controller's live smoke** (verification section). Here, just confirm the code path compiles and that `withMcpAuth(..., { required: true })` is what returns 401 on `undefined`. No runtime step in this task beyond typecheck.

- [ ] **Step 4: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): hashed-bearer auth on /api/mcp resolving household into tool context"
```

---

## Task 5: Household-scoped read queries

**Files:**
- Create: `src/lib/mcp-queries.ts`
- Create: `src/lib/mcp-queries.test.ts`

**Interfaces:**
- Consumes: `prisma`; pure helpers `computeNeedToBuy` from `@/lib/need-to-buy`, `cheapestByItem` from `@/lib/cheapest-price`, `isLowStock` from `@/lib/need-to-buy` (confirm exact export names in those files — the summary lists `isLowStock` + `computeNeedToBuy` in `need-to-buy.ts` and `cheapestByItem` in `cheapest-price.ts`).
- Produces:
  - `searchItems(householdId: string, query: string, limit?: number): Promise<{ id: string; name: string; nameHe: string | null; emoji: string | null; category: string | null }[]>`
  - `getLists(householdId: string, status?: "open" | "all"): Promise<{ id: string; name: string; status: string; items: { name: string; quantity: number | null; bought: boolean }[] }[]>`
  - `getNeedToBuy(householdId: string): Promise<ReturnType-of-computeNeedToBuy-shape>`
  - `listTags(householdId: string, type?: string): Promise<{ id: string; name: string; type: string; itemCount: number }[]>`
  - `listPrices(householdId: string, itemId?: string): Promise<{ item: string; price: number; store: string | null; purchasedAt: string; cheapest: boolean }[]>`

- [ ] **Step 1: Confirm the pure-helper signatures**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && sed -n '1,60p' src/lib/need-to-buy.ts && echo '--- cheapest ---' && sed -n '1,40p' src/lib/cheapest-price.ts`
Note the exact exported names, parameter shapes, and return types. Use them verbatim in `getNeedToBuy` and `listPrices`. If a helper's input shape differs from what Step 3 assumes, adapt the mapping (do not change the helper).

- [ ] **Step 2: Write the failing test (shaping helper)**

The only unit-testable pure piece here is the price-row → cheapest-flag shaping. Extract it as `markCheapest`. Create `src/lib/mcp-queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { markCheapest } from "./mcp-queries";

describe("markCheapest", () => {
  it("flags the min-price row per item", () => {
    const rows = [
      { item: "Milk", price: 7.5, store: "A", purchasedAt: "2026-08-01" },
      { item: "Milk", price: 6.9, store: "B", purchasedAt: "2026-08-02" },
      { item: "Eggs", price: 12, store: "A", purchasedAt: "2026-08-01" },
    ];
    const out = markCheapest(rows);
    expect(out.find((r) => r.item === "Milk" && r.price === 6.9)!.cheapest).toBe(true);
    expect(out.find((r) => r.item === "Milk" && r.price === 7.5)!.cheapest).toBe(false);
    expect(out.find((r) => r.item === "Eggs")!.cheapest).toBe(true);
  });
  it("handles an empty list", () => {
    expect(markCheapest([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mcp-queries.test.ts`
Expected: FAIL — cannot resolve `markCheapest`.

- [ ] **Step 4: Write the query layer**

Create `src/lib/mcp-queries.ts`. Adjust field names (`item.name` vs `item.nameEn`, list `status` enum values, tag `type`, price `purchasedAt`) to match the Prisma schema from Phase 1–4 — cross-check against `prisma/schema.prisma`:

```ts
import { prisma } from "@/lib/prisma";

type PriceRow = { item: string; price: number; store: string | null; purchasedAt: string };

/** Flag the minimum-price row per item. Pure — unit tested. */
export function markCheapest(rows: PriceRow[]): (PriceRow & { cheapest: boolean })[] {
  const min = new Map<string, number>();
  for (const r of rows) {
    const cur = min.get(r.item);
    if (cur === undefined || r.price < cur) min.set(r.item, r.price);
  }
  return rows.map((r) => ({ ...r, cheapest: r.price === min.get(r.item) }));
}

export async function searchItems(householdId: string, query: string, limit = 10) {
  const items = await prisma.item.findMany({
    where: {
      householdId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameHe: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true, name: true, nameHe: true, emoji: true, category: { select: { name: true } } },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    nameHe: i.nameHe,
    emoji: i.emoji,
    category: i.category?.name ?? null,
  }));
}

export async function getLists(householdId: string, status: "open" | "all" = "open") {
  const lists = await prisma.groceryList.findMany({
    where: {
      householdId,
      ...(status === "open" ? { status: { not: "completed" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      items: { select: { quantity: true, bought: true, item: { select: { name: true } } } },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    items: l.items.map((li) => ({ name: li.item?.name ?? "?", quantity: li.quantity, bought: li.bought })),
  }));
}

export async function getNeedToBuy(householdId: string) {
  // Reuse the Phase-4a pipeline: low-stock rows + open-list unbought items → computeNeedToBuy.
  // Mirror src/app/(app)/stock/page.tsx's server read, but filtered to `householdId` explicitly.
  const { computeNeedToBuy } = await import("@/lib/need-to-buy");

  const stockRows = await prisma.stock.findMany({
    where: { householdId },
    select: { quantity: true, lowThreshold: true, item: { select: { id: true, name: true, emoji: true } } },
  });
  const openListItems = await prisma.listItem.findMany({
    where: { list: { householdId, status: { not: "completed" } }, bought: false },
    select: { quantity: true, item: { select: { id: true, name: true, emoji: true } }, list: { select: { name: true } } },
  });

  // Shape the two inputs to match computeNeedToBuy's expected params (confirm in Step 1).
  const lowStock = stockRows
    .filter((s) => s.item && s.quantity <= s.lowThreshold)
    .map((s) => ({ item: s.item!, quantity: s.quantity, lowThreshold: s.lowThreshold }));
  const onList = openListItems
    .filter((li) => li.item)
    .map((li) => ({ item: li.item!, listName: li.list?.name ?? "?", quantity: li.quantity }));

  return computeNeedToBuy({ lowStock, onList });
}

export async function listTags(householdId: string, type?: string) {
  const tags = await prisma.tag.findMany({
    where: { householdId, ...(type ? { type } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, _count: { select: { items: true } } },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, type: t.type, itemCount: t._count.items }));
}

export async function listPrices(householdId: string, itemId?: string) {
  const entries = await prisma.priceHistory.findMany({
    where: { householdId, ...(itemId ? { itemId } : {}) },
    orderBy: { purchasedAt: "desc" },
    select: { price: true, store: true, purchasedAt: true, item: { select: { name: true } } },
  });
  const rows: PriceRow[] = entries.map((e) => ({
    item: e.item?.name ?? "?",
    price: Number(e.price),
    store: e.store,
    purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
  }));
  return markCheapest(rows);
}
```

> The `import("@/lib/need-to-buy")` is a lazy import only to keep the top of the file clean; a normal top-level `import { computeNeedToBuy }` is equally fine — match the `_count.select.items` relation name (`items` vs `itemTags`) and the `ItemTag` join to the actual schema (`Tag.items` may be `Tag.itemTags`). Cross-check `prisma/schema.prisma`.

- [ ] **Step 5: Run test + typecheck**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mcp-queries.test.ts && npx tsc --noEmit`
Expected: test PASS; no type errors. (Fix relation/field-name mismatches against the schema until `tsc` is clean.)

- [ ] **Step 6: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mcp-queries.ts src/lib/mcp-queries.test.ts
git commit -m "feat(mcp): household-scoped read queries (search/lists/need-to-buy/tags/prices)"
```

---

## Task 6: The 5 read tools

**Files:**
- Modify: `src/app/api/mcp/route.ts` (replace the `ping` tool with the 5 read tools)

**Interfaces:**
- Consumes: `mcp-queries` functions (Task 5); the auth context `householdId` (Task 4).
- Produces: `tools/list` returns exactly `search_items, get_lists, get_need_to_buy, list_tags, list_prices`; each returns JSON text scoped to the token's household.

- [ ] **Step 1: Register the 5 tools**

In `src/app/api/mcp/route.ts`, replace the `ping` registration inside `createMcpHandler`'s setup with the 5 tools. Keep a small helper to read the household and to serialize:

```ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";
import { searchItems, getLists, getNeedToBuy, listTags, listPrices } from "@/lib/mcp-queries";

function hh(extra: unknown): string {
  const id = (extra as { authInfo?: { extra?: { householdId?: string } } })?.authInfo?.extra?.householdId;
  if (!id) throw new Error("No household in auth context");
  return id;
}
const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_items",
      "Search this household's catalog items by name (English or Hebrew). Returns id, name, emoji, category.",
      { query: z.string().describe("substring to match"), limit: z.number().int().positive().optional() },
      async ({ query, limit }, extra) => json(await searchItems(hh(extra), query, limit ?? 10)),
    );
    server.tool(
      "get_lists",
      "Get this household's grocery lists with their items. status 'open' (default) excludes completed lists; 'all' includes them.",
      { status: z.enum(["open", "all"]).optional() },
      async ({ status }, extra) => json(await getLists(hh(extra), status ?? "open")),
    );
    server.tool(
      "get_need_to_buy",
      "Get what this household needs to buy: low-stock items plus unbought items on open lists, deduped with reasons.",
      {},
      async (_args, extra) => json(await getNeedToBuy(hh(extra))),
    );
    server.tool(
      "list_tags",
      "List this household's tags (recipe/store/custom) with item counts. Optional type filter.",
      { type: z.enum(["recipe", "store", "custom"]).optional() },
      async ({ type }, extra) => json(await listTags(hh(extra), type)),
    );
    server.tool(
      "list_prices",
      "List recorded prices for this household, newest first, with a cheapest flag per item. Optional itemId filter.",
      { itemId: z.string().optional() },
      async ({ itemId }, extra) => json(await listPrices(hh(extra), itemId)),
    );
  },
  { serverInfo: { name: "grocery", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: true },
);

const authedHandler = withMcpAuth(
  baseHandler,
  async (_req: Request, bearer?: string) => {
    if (!bearer) return undefined;
    const v = await verifyMcpToken(bearer);
    if (!v) return undefined;
    return { token: bearer, scopes: [], clientId: v.tokenId, extra: { householdId: v.householdId, userId: v.userId } };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
```

> Keep the auth `extra` shape and the `hh(extra)` read in sync with whatever Task 3/4 established from the installed adapter types. The tool-handler signature `(args, extra)` and how `extra` carries `authInfo` must match the SDK version installed.

- [ ] **Step 2: Typecheck + lint**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npx next lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): 5 read tools (search_items/get_lists/get_need_to_buy/list_tags/list_prices)"
```

---

## Task 7: Connect-to-Claude settings UI

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/components/McpTokensCard.tsx`
- Modify: `src/app/(app)/layout.tsx` (add Settings nav link)
- Modify: `src/i18n/dictionaries/en.ts` + `src/i18n/dictionaries/he.ts`

**Interfaces:**
- Consumes: `listMcpTokens` from `@/lib/mcp-token`; `requireUser` from `@/lib/auth-guard`; actions `generateMcpToken`/`revokeMcpTokenAction` from `@/actions/mcp-tokens`; `getDictionary`/`t` from `@/i18n`; `Button`/`Input` components (match the import paths used by existing managers, e.g. `@/components/ui/*`).
- Produces: a `/settings` page listing tokens + a generate/revoke card with connection instructions.

- [ ] **Step 1: Add i18n keys (both dictionaries)**

In `src/i18n/dictionaries/en.ts` add `settings: "Settings"` to `catalog.nav` and a new top-level `settings` group:

```ts
// inside catalog.nav: add   settings: "Settings",
settings: {
  title: "Settings",
  connect: {
    heading: "Connect to Claude",
    intro: "Generate a token to let Claude read and manage your groceries via MCP.",
    namePlaceholder: "Token name (e.g. Claude Desktop)",
    generate: "Generate token",
    generating: "Generating...",
    oncePrefix: "Copy this token now — it won't be shown again:",
    copy: "Copy",
    copied: "Copied",
    revoke: "Revoke",
    revokeConfirm: "Revoke this token? Any client using it will stop working.",
    empty: "No tokens yet.",
    created: "Created",
    lastUsed: "Last used",
    never: "never",
    lastFour: "ending {four}",
    instructionsHeading: "How to connect",
    instructions:
      "Add this to your Claude Desktop MCP config (Settings → Developer), using the token above as the Authorization bearer.",
    endpointLabel: "MCP endpoint",
  },
},
```

In `src/i18n/dictionaries/he.ts` add the same keys with Hebrew values (parity is enforced by `he: typeof en`). Suggested translations:

```ts
// inside catalog.nav: add   settings: "הגדרות",
settings: {
  title: "הגדרות",
  connect: {
    heading: "חיבור ל‑Claude",
    intro: "צור טוקן כדי לאפשר ל‑Claude לקרוא ולנהל את הקניות שלך דרך MCP.",
    namePlaceholder: "שם הטוקן (למשל Claude Desktop)",
    generate: "צור טוקן",
    generating: "יוצר...",
    oncePrefix: "העתק את הטוקן עכשיו — הוא לא יוצג שוב:",
    copy: "העתק",
    copied: "הועתק",
    revoke: "בטל",
    revokeConfirm: "לבטל את הטוקן? כל לקוח שמשתמש בו יפסיק לעבוד.",
    empty: "אין טוקנים עדיין.",
    created: "נוצר",
    lastUsed: "שימוש אחרון",
    never: "אף פעם",
    lastFour: "מסתיים ב‑{four}",
    instructionsHeading: "איך להתחבר",
    instructions:
      "הוסף זאת להגדרות ה‑MCP של Claude Desktop (הגדרות → מפתחים), עם הטוקן שלמעלה כ‑Authorization bearer.",
    endpointLabel: "כתובת MCP",
  },
},
```

- [ ] **Step 2: Typecheck the dictionaries (parity)**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit`
Expected: no errors (if a key is missing from `he.ts`, `he: typeof en` fails here).

- [ ] **Step 3: Write the settings page (server component)**

Create `src/app/(app)/settings/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth-guard";
import { listMcpTokens } from "@/lib/mcp-token";
import { getDictionary, t } from "@/i18n";
import { McpTokensCard } from "@/components/McpTokensCard";

const d = getDictionary("en");

export default async function SettingsPage() {
  const user = await requireUser();
  const tokens = await listMcpTokens(user.id);
  const endpoint = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + "/api/mcp";
  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-extrabold">{t(d, "settings.title")}</h1>
      <McpTokensCard
        initialTokens={tokens.map((tk) => ({
          id: tk.id,
          name: tk.name,
          lastFour: tk.lastFour,
          createdAt: tk.createdAt.toISOString(),
          lastUsedAt: tk.lastUsedAt ? tk.lastUsedAt.toISOString() : null,
        }))}
        endpoint={endpoint}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the tokens card (client component)**

Create `src/components/McpTokensCard.tsx`. Match the import paths/props of `Button`/`Input` used by existing managers (check `src/components/StockManager.tsx` imports and copy them):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, t } from "@/i18n";
import { generateMcpToken, revokeMcpTokenAction } from "@/actions/mcp-tokens";
// import Button/Input matching the paths used in StockManager.tsx

const d = getDictionary("en");

type TokenView = {
  id: string;
  name: string | null;
  lastFour: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export function McpTokensCard({
  initialTokens,
  endpoint,
}: {
  initialTokens: TokenView[];
  endpoint: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate() {
    setPending(true);
    setError(null);
    const res = await generateMcpToken({ name });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRawToken(res.raw);
    setName("");
    router.refresh();
  }

  async function onRevoke(id: string) {
    if (!confirm(t(d, "settings.connect.revokeConfirm"))) return;
    const res = await revokeMcpTokenAction(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        grocery: { url: endpoint, headers: { Authorization: "Bearer <YOUR_TOKEN>" } },
      },
    },
    null,
    2,
  );

  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-lg font-bold">{t(d, "settings.connect.heading")}</h2>
      <p className="mt-1 text-sm text-ink/70">{t(d, "settings.connect.intro")}</p>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded border border-border px-2 py-1"
          placeholder={t(d, "settings.connect.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded bg-brand px-3 py-1 font-semibold text-white disabled:opacity-50"
          disabled={pending || !name.trim()}
          onClick={onGenerate}
        >
          {pending ? t(d, "settings.connect.generating") : t(d, "settings.connect.generate")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rawToken && (
        <div className="mt-3 rounded border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm font-medium">{t(d, "settings.connect.oncePrefix")}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 text-sm">{rawToken}</code>
            <button
              className="rounded border border-border px-2 py-1 text-sm"
              onClick={() => {
                navigator.clipboard.writeText(rawToken);
                setCopied(true);
              }}
            >
              {copied ? t(d, "settings.connect.copied") : t(d, "settings.connect.copy")}
            </button>
          </div>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border">
        {initialTokens.length === 0 && (
          <li className="py-2 text-sm text-ink/60">{t(d, "settings.connect.empty")}</li>
        )}
        {initialTokens.map((tk) => (
          <li key={tk.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <span className="font-medium">{tk.name ?? "—"}</span>{" "}
              <span className="text-ink/50">
                {t(d, "settings.connect.lastFour", { four: tk.lastFour ?? "????" })}
              </span>
            </span>
            <button className="text-red-600 hover:underline" onClick={() => onRevoke(tk.id)}>
              {t(d, "settings.connect.revoke")}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <h3 className="text-sm font-semibold">{t(d, "settings.connect.instructionsHeading")}</h3>
        <p className="mt-1 text-sm text-ink/70">{t(d, "settings.connect.instructions")}</p>
        <p className="mt-2 text-xs text-ink/60">
          {t(d, "settings.connect.endpointLabel")}: <code>{endpoint}</code>
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-ink/5 p-2 text-xs">{configSnippet}</pre>
      </div>
    </section>
  );
}
```

> `t(d, key, { four })` interpolation must match the existing `t` signature (the summary shows `t(d, "common.greeting", { name })`-style interpolation is supported). If `t` interpolates differently, adjust the `lastFour`/`greeting`-style calls to the real API. Colors (`brand`, `ink`, `border`) are the Phase-1 theme tokens.

- [ ] **Step 5: Add the Settings nav link**

Modify `src/app/(app)/layout.tsx` — add a link next to the household name / logout. Minimal change:

```tsx
import Link from "next/link";
// ...
<nav className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
  <span className="font-extrabold">{household.name}</span>
  <div className="flex items-center gap-4">
    <Link href="/settings" className="text-sm font-medium hover:underline">
      {t(d, "catalog.nav.settings")}
    </Link>
    <LogoutButton label={t(d, "auth.logout")} />
  </div>
</nav>
```

- [ ] **Step 6: Typecheck + lint + full test run**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npx next lint && npx vitest run`
Expected: no type/lint errors; all unit tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/\(app\)/settings/page.tsx src/components/McpTokensCard.tsx src/app/\(app\)/layout.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(mcp): Connect-to-Claude settings UI (generate/revoke tokens + instructions)"
```

---

## Verification (controller-run — needs the live DB)

After all tasks land, the controller runs the DB migration + a full live smoke test against Prisma Postgres (the subagents only verify offline, since auth + tools require DB rows).

- [ ] **1. Apply the migration**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx prisma migrate dev --name add_mcp_tokens
```
Expected: a new migration under `prisma/migrations/`, `McpToken` table created. Commit the migration.

- [ ] **2. Live smoke test** (dev server on 3001; a signed-in session to generate a token, then MCP curl calls):
  - Start `PORT=3001 npm run dev`; sign in (or reuse a smoke-test user via the better-auth signup endpoint as in prior phases) and open `/settings`; generate a token; copy the raw value. (Or generate a token directly via a `node --env-file=.env` script calling `createMcpToken` for a known household — the pattern used in prior phases.)
  - `tools/list` with the bearer → the 5 read tools appear.
  - `tools/call get_need_to_buy` (bearer) → household-scoped need-to-buy JSON.
  - `tools/call search_items {query:"milk"}` (bearer) → matching items for that household only.
  - A **bad** bearer → HTTP 401.
  - A token for household A cannot read household B's data (call a tool with A's token, confirm only A's rows).
  - Revoke the token in `/settings` → subsequent calls 401.
  - Flip `BETTER_AUTH_URL` back to `:3000` after testing.

- [ ] **3. Final whole-branch review** (two-stage, as in prior phases) before pushing `next-migration`.

---

## Self-Review

**Spec coverage:** McpToken model + migration ✓ (Task 1 + verification); token lib (generate/hash/create/verify/list/revoke) ✓ (Task 2); token-management UI with generate-once/revoke/instructions ✓ (Task 7); `/api/mcp` route with mcp-handler transport ✓ (Task 3) + hashed-bearer auth resolving household ✓ (Task 4); household-scoped read queries ✓ (Task 5); the 5 read tools ✓ (Task 6); i18n `settings` group + nav ✓ (Task 7); authorization rules (raw never stored, household scoping, user-scoped token mgmt) ✓ (Tasks 2/4/5); testing (pure token helpers + markCheapest + live smoke) ✓.

**Placeholder scan:** No TBD/TODO. The mcp-handler API shape is explicitly "verify against installed types and adapt" — this is a deliberate, bounded instruction for an external dependency I can't introspect offline, not a placeholder; the transport spike (Task 3) forces resolution before dependent tasks. `<YOUR_TOKEN>` in the config snippet is intended literal UI copy.

**Type consistency:** `householdId`-first query signatures are consistent across Tasks 5 and 6; `generateMcpToken`/`revokeMcpTokenAction` names match between Task 2 (actions) and Task 7 (UI import); `markCheapest`/`verifyMcpToken`/`createMcpToken` names are used identically where referenced; auth `extra.householdId` read is consistently flagged to track the installed adapter shape across Tasks 4 and 6.

**Known adaptation points (flagged inline for implementers):** exact `mcp-handler` export/option/`AuthInfo` shapes (Task 3 Step 2 → Tasks 4/6); exact Prisma relation/field names for tags (`items` vs `itemTags`), list `status` enum, price fields (Task 5 vs schema); `requireHousehold()` return field (Task 2); `t()` interpolation + `Button`/`Input` import paths (Task 7). Each is a "confirm against the real file and adjust" instruction, appropriate because these are established facts in the codebase the implementer can read directly.
