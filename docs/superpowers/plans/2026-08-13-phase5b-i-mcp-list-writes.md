# GroceryApp Phase 5b-i — MCP List/Shopping Write Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 household-scoped MCP write tools for lists/shopping (`add_to_list`, `mark_list_item`, `edit_list_item`, `manage_list`) by extracting the list + list-item write logic into a shared core that both the web actions and the MCP tools call.

**Architecture:** Each existing write action's household-scoped body moves into a core function taking explicit `(householdId, userId, input)`. Web actions become thin wrappers (resolve session → call core → `revalidatePath`), keeping their exact public return types. MCP tools call the same core with the token's household/user (from `hh(extra)`/a new `uid(extra)`), returning the result as JSON.

**Tech Stack:** Next.js 16 App Router, Prisma 6, `@modelcontextprotocol/sdk` via `mcp-handler@1.1.0`, Zod 4, Vitest 4, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- Lint command is **`npm run lint`** (bare eslint), NOT `npx next lint`.
- MCP tools are ID-based; `userId` for `createdById`/`boughtById` comes ONLY from the token context (`uid(extra)`), never from tool input.
- Web action wrappers MUST preserve their exact current public signatures + return types (`Result` / `CreateResult` / `CompleteResult`) — the UI (`ListsManager`, `ListDetail`) must be behaviorally unchanged; `tsc` across consumers proves it.
- Cores live under `src/lib/mutations/`, contain NO `"use server"` and NO `revalidatePath` (that stays in the action wrappers).
- Every core mutation is scoped by `householdId`; ownership gates reject cross-household ids with `{ ok: false, error: "…not found" }`.
- Keep the `server.tool(name, desc, zodSchema, handler)` overload (deprecated-but-consistent across this MCP server). Keep the 5 existing read tools + the auth wrapper unchanged.
- Result type reused verbatim: `type Result = { ok: true } | { ok: false; error: string }`.

---

## File Structure

- `src/lib/mutations/util.ts` — shared `clean` + `normalizeQuantity` (Task 1).
- `src/lib/mutations/util.test.ts` — unit tests (Task 1).
- `src/lib/mutations/list-items.ts` — list-item write core + ownership gates (Task 1).
- `src/actions/list-items.ts` — rewritten as thin wrappers (Task 1).
- `src/lib/mutations/lists.ts` — list write core (Task 2).
- `src/actions/lists.ts` — rewritten as thin wrappers (Task 2).
- `src/app/api/mcp/route.ts` — add `uid(extra)` + 4 write tools (Task 3).

---

## Task 1: Extract list-item write core + thin wrappers

**Files:**
- Create: `src/lib/mutations/util.ts`, `src/lib/mutations/util.test.ts`, `src/lib/mutations/list-items.ts`
- Modify: `src/actions/list-items.ts` (rewrite bodies; keep exports + public types)

**Interfaces:**
- Produces:
  - `clean(s: string | undefined | null): string | null`
  - `normalizeQuantity(n: number): number`
  - `addListItemCore(householdId: string, input: { listId: string; itemId: string; quantity: number; unit: string; notes?: string }): Result`
  - `updateListItemCore(householdId: string, input: { listItemId: string; quantity: number; unit: string; notes?: string }): { ok: true; listId: string } | { ok: false; error: string }`
  - `removeListItemCore(householdId: string, input: { listItemId: string }): { ok: true; listId: string } | { ok: false; error: string }`
  - `setListItemBoughtCore(householdId: string, userId: string | null, input: { listItemId: string; isBought: boolean }): { ok: true; listId: string } | { ok: false; error: string }`
  - Action wrappers unchanged in signature: `addListItem`, `updateListItem`, `removeListItem`, `setListItemBought` (all return `Promise<Result>`).

- [ ] **Step 1: Write the failing test for the shared helpers**

Create `src/lib/mutations/util.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clean, normalizeQuantity } from "./util";

describe("clean", () => {
  it("trims and returns non-empty", () => expect(clean("  hi ")).toBe("hi"));
  it("empty/whitespace → null", () => {
    expect(clean("   ")).toBeNull();
    expect(clean("")).toBeNull();
    expect(clean(undefined)).toBeNull();
    expect(clean(null)).toBeNull();
  });
});

describe("normalizeQuantity", () => {
  it("keeps a positive finite number", () => expect(normalizeQuantity(3)).toBe(3));
  it("0, negative, NaN, Infinity → 1", () => {
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-2)).toBe(1);
    expect(normalizeQuantity(Number.NaN)).toBe(1);
    expect(normalizeQuantity(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/util.test.ts`
Expected: FAIL — cannot resolve `./util`.

- [ ] **Step 3: Write the shared helpers**

Create `src/lib/mutations/util.ts`:

```ts
export function clean(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v ? v : null;
}

export function normalizeQuantity(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/util.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the list-item core**

Create `src/lib/mutations/list-items.ts` (ownership gates moved here from the action; core mirrors the action bodies exactly, keyed by explicit ids, no `revalidatePath`):

```ts
import { prisma } from "@/lib/prisma";
import { clean, normalizeQuantity } from "./util";

type Result = { ok: true } | { ok: false; error: string };
type ResultWithList = { ok: true; listId: string } | { ok: false; error: string };

// True iff the list belongs to the household.
async function listOwned(householdId: string, listId: string): Promise<boolean> {
  const list = await prisma.groceryList.findFirst({
    where: { id: listId, householdId },
    select: { id: true },
  });
  return Boolean(list);
}

// Returns the list_item's listId iff its parent list belongs to the household, else null.
async function listItemListId(householdId: string, listItemId: string): Promise<string | null> {
  const li = await prisma.listItem.findFirst({
    where: { id: listItemId, list: { householdId } },
    select: { listId: true },
  });
  return li?.listId ?? null;
}

export async function addListItemCore(
  householdId: string,
  input: { listId: string; itemId: string; quantity: number; unit: string; notes?: string },
): Promise<Result> {
  if (!(await listOwned(householdId, input.listId))) return { ok: false, error: "List not found" };
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, householdId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Item not found" };
  await prisma.listItem.create({
    data: {
      listId: input.listId,
      itemId: input.itemId,
      quantity: normalizeQuantity(input.quantity),
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  return { ok: true };
}

export async function updateListItemCore(
  householdId: string,
  input: { listItemId: string; quantity: number; unit: string; notes?: string },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      quantity: normalizeQuantity(input.quantity),
      unit: clean(input.unit) ?? "pcs",
      notes: clean(input.notes),
    },
  });
  return { ok: true, listId };
}

export async function removeListItemCore(
  householdId: string,
  input: { listItemId: string },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.delete({ where: { id: input.listItemId } });
  return { ok: true, listId };
}

export async function setListItemBoughtCore(
  householdId: string,
  userId: string | null,
  input: { listItemId: string; isBought: boolean },
): Promise<ResultWithList> {
  const listId = await listItemListId(householdId, input.listItemId);
  if (!listId) return { ok: false, error: "List item not found" };
  await prisma.listItem.update({
    where: { id: input.listItemId },
    data: {
      isBought: input.isBought,
      boughtById: input.isBought ? userId : null,
      boughtAt: input.isBought ? new Date() : null,
    },
  });
  return { ok: true, listId };
}
```

- [ ] **Step 6: Rewrite the action as thin wrappers**

Replace the bodies in `src/actions/list-items.ts` (keep `"use server"`, keep every export name + return type; delegate to the core, keep the same `revalidatePath` calls). The full new file:

```ts
"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import {
  addListItemCore,
  updateListItemCore,
  removeListItemCore,
  setListItemBoughtCore,
} from "@/lib/mutations/list-items";

type Result = { ok: true } | { ok: false; error: string };

export async function addListItem(input: {
  listId: string;
  itemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await addListItemCore(household.id, input);
  if (res.ok) {
    revalidatePath(`/lists/${input.listId}`);
    revalidatePath("/lists");
  }
  return res;
}

export async function updateListItem(input: {
  listItemId: string;
  quantity: number;
  unit: string;
  notes?: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const res = await updateListItemCore(household.id, input);
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}

export async function removeListItem(listItemId: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await removeListItemCore(household.id, { listItemId });
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}

export async function setListItemBought(input: {
  listItemId: string;
  isBought: boolean;
}): Promise<Result> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await setListItemBoughtCore(household.id, user?.id ?? null, input);
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.listId}`);
  return { ok: true };
}
```

- [ ] **Step 7: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/mutations/util.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type errors (proves `ListDetail`/`ListsManager` still typecheck against the unchanged action signatures); lint clean.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/util.ts src/lib/mutations/util.test.ts src/lib/mutations/list-items.ts src/actions/list-items.ts
git commit -m "refactor(lists): extract list-item write core; actions become thin wrappers"
```

---

## Task 2: Extract list write core + thin wrappers

**Files:**
- Create: `src/lib/mutations/lists.ts`
- Modify: `src/actions/lists.ts` (rewrite bodies; keep exports + public types)

**Interfaces:**
- Consumes: `clean` from `@/lib/mutations/util` (Task 1).
- Produces:
  - `createListCore(householdId: string, userId: string | null, input: { name: string }): { ok: true; id: string } | { ok: false; error: string }`
  - `renameListCore(householdId: string, input: { id: string; name: string }): Result`
  - `deleteListCore(householdId: string, input: { id: string }): Result`
  - `duplicateListCore(householdId: string, userId: string | null, input: { id: string }): { ok: true; id: string } | { ok: false; error: string }`
  - `completeListCore(householdId: string, userId: string | null, input: { listId: string; carryOver: boolean }): { ok: true; carriedOverListId?: string } | { ok: false; error: string }`
  - Action wrappers unchanged: `createList`→`CreateResult`, `renameList`→`Result`, `deleteList`→`Result`, `duplicateList`→`CreateResult`, `completeList`→`CompleteResult`.

- [ ] **Step 1: Write the list core**

Create `src/lib/mutations/lists.ts` (bodies mirror `src/actions/lists.ts` exactly, keyed by explicit ids, no `revalidatePath`):

```ts
import { prisma } from "@/lib/prisma";
import { clean } from "./util";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CompleteResult = { ok: true; carriedOverListId?: string } | { ok: false; error: string };

export async function createListCore(
  householdId: string,
  userId: string | null,
  input: { name: string },
): Promise<CreateResult> {
  const cleaned = clean(input.name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const list = await prisma.groceryList.create({
    data: { householdId, name: cleaned, status: "draft", createdById: userId },
    select: { id: true },
  });
  return { ok: true, id: list.id };
}

export async function renameListCore(
  householdId: string,
  input: { id: string; name: string },
): Promise<Result> {
  const cleaned = clean(input.name);
  if (!cleaned) return { ok: false, error: "Please enter a list name" };
  const res = await prisma.groceryList.updateMany({
    where: { id: input.id, householdId },
    data: { name: cleaned },
  });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}

export async function deleteListCore(
  householdId: string,
  input: { id: string },
): Promise<Result> {
  // ListItem rows cascade via the FK.
  const res = await prisma.groceryList.deleteMany({ where: { id: input.id, householdId } });
  if (res.count === 0) return { ok: false, error: "List not found" };
  return { ok: true };
}

export async function duplicateListCore(
  householdId: string,
  userId: string | null,
  input: { id: string },
): Promise<CreateResult> {
  const source = await prisma.groceryList.findFirst({
    where: { id: input.id, householdId },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true } },
    },
  });
  if (!source) return { ok: false, error: "List not found" };
  const copy = await prisma.groceryList.create({
    data: {
      householdId,
      name: `${source.name} (copy)`,
      status: "draft",
      createdById: userId,
      items: {
        create: source.items.map((li) => ({
          itemId: li.itemId,
          quantity: li.quantity,
          unit: li.unit,
          notes: li.notes,
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, id: copy.id };
}

export async function completeListCore(
  householdId: string,
  userId: string | null,
  input: { listId: string; carryOver: boolean },
): Promise<CompleteResult> {
  const list = await prisma.groceryList.findFirst({
    where: { id: input.listId, householdId },
    select: {
      name: true,
      items: { select: { itemId: true, quantity: true, unit: true, notes: true, isBought: true } },
    },
  });
  if (!list) return { ok: false, error: "List not found" };

  const unbought = list.items.filter((li) => !li.isBought);
  const shouldCarry = input.carryOver && unbought.length > 0;

  const carriedOverListId = await prisma.$transaction(async (tx) => {
    await tx.groceryList.update({
      where: { id: input.listId },
      data: { status: "completed", completedAt: new Date() },
    });
    if (!shouldCarry) return undefined as string | undefined;
    const copy = await tx.groceryList.create({
      data: {
        householdId,
        name: `${list.name} (carried over)`,
        status: "draft",
        createdById: userId,
        items: {
          create: unbought.map((li) => ({
            itemId: li.itemId,
            quantity: li.quantity,
            unit: li.unit,
            notes: li.notes,
          })),
        },
      },
      select: { id: true },
    });
    return copy.id;
  });

  return { ok: true, carriedOverListId };
}
```

- [ ] **Step 2: Rewrite the action as thin wrappers**

Replace the bodies in `src/actions/lists.ts` (keep `"use server"`, every export name + return type, and the same `revalidatePath` calls). The full new file:

```ts
"use server";

import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import {
  createListCore,
  renameListCore,
  deleteListCore,
  duplicateListCore,
  completeListCore,
} from "@/lib/mutations/lists";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CompleteResult = { ok: true; carriedOverListId?: string } | { ok: false; error: string };

export async function createList({ name }: { name: string }): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await createListCore(household.id, user?.id ?? null, { name });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function renameList({ id, name }: { id: string; name: string }): Promise<Result> {
  const household = await requireHousehold();
  const res = await renameListCore(household.id, { id, name });
  if (res.ok) {
    revalidatePath("/lists");
    revalidatePath(`/lists/${id}`);
  }
  return res;
}

export async function deleteList(id: string): Promise<Result> {
  const household = await requireHousehold();
  const res = await deleteListCore(household.id, { id });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function duplicateList(id: string): Promise<CreateResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await duplicateListCore(household.id, user?.id ?? null, { id });
  if (res.ok) revalidatePath("/lists");
  return res;
}

export async function completeList(input: {
  listId: string;
  carryOver: boolean;
}): Promise<CompleteResult> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const res = await completeListCore(household.id, user?.id ?? null, input);
  if (res.ok) {
    revalidatePath("/lists");
    revalidatePath(`/lists/${input.listId}`);
  }
  return res;
}
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors (proves `ListsManager`/`ListDetail` still typecheck); lint clean; all tests pass.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/lib/mutations/lists.ts src/actions/lists.ts
git commit -m "refactor(lists): extract list write core; actions become thin wrappers"
```

---

## Task 3: MCP write tools

**Files:**
- Modify: `src/app/api/mcp/route.ts` (add `uid(extra)` helper + 4 write tools; keep the 5 read tools + auth wrapper unchanged)

**Interfaces:**
- Consumes: the list-item + list cores (Tasks 1–2); the existing `hh(extra)` helper; the auth context `userId` (already set by the 5a verify callback as `extra.authInfo.extra.userId`).
- Produces: `tools/list` now also returns `add_to_list`, `mark_list_item`, `edit_list_item`, `manage_list`.

- [ ] **Step 1: Add the `uid` helper + import the cores**

At the top of `src/app/api/mcp/route.ts`, add imports and a `uid(extra)` helper mirroring the existing `hh(extra)`:

```ts
import { addListItemCore, updateListItemCore, setListItemBoughtCore } from "@/lib/mutations/list-items";
import { createListCore, renameListCore, deleteListCore, duplicateListCore, completeListCore } from "@/lib/mutations/lists";

function uid(extra: unknown): string {
  const id = (extra as { authInfo?: { extra?: { userId?: string } } })?.authInfo?.extra?.userId;
  if (!id) throw new Error("No user in auth context");
  return id;
}
```

(Keep the existing `hh(extra)` and `json(...)` helpers as they are.)

- [ ] **Step 2: Register the 4 write tools**

Inside `createMcpHandler`'s setup callback, after the 5 read tools, register the write tools:

```ts
server.tool(
  "add_to_list",
  "Add a catalog item to a grocery list. Get listId from get_lists and itemId from search_items.",
  {
    listId: z.string(),
    itemId: z.string(),
    quantity: z.number().positive().optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ listId, itemId, quantity, unit, notes }, extra) =>
    json(await addListItemCore(hh(extra), { listId, itemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })),
);

server.tool(
  "mark_list_item",
  "Mark a list line as bought or not bought. Get listItemId from get_lists (a list's items).",
  { listItemId: z.string(), bought: z.boolean() },
  async ({ listItemId, bought }, extra) =>
    json(await setListItemBoughtCore(hh(extra), uid(extra), { listItemId, isBought: bought })),
);

server.tool(
  "edit_list_item",
  "Edit a list line's quantity, unit, or notes. Get listItemId from get_lists.",
  {
    listItemId: z.string(),
    quantity: z.number().positive().optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ listItemId, quantity, unit, notes }, extra) =>
    json(await updateListItemCore(hh(extra), { listItemId, quantity: quantity ?? 1, unit: unit ?? "pcs", notes })),
);

server.tool(
  "manage_list",
  "Create, rename, complete, delete, or duplicate a grocery list. 'delete' removes the list AND its items. 'complete' with carryOver spawns a new draft holding the unbought items.",
  {
    action: z.enum(["create", "rename", "complete", "delete", "duplicate"]),
    name: z.string().optional(),
    listId: z.string().optional(),
    carryOver: z.boolean().optional(),
  },
  async ({ action, name, listId, carryOver }, extra) => {
    const householdId = hh(extra);
    switch (action) {
      case "create":
        if (!name) return json({ ok: false, error: "name is required to create a list" });
        return json(await createListCore(householdId, uid(extra), { name }));
      case "rename":
        if (!listId || !name) return json({ ok: false, error: "listId and name are required to rename" });
        return json(await renameListCore(householdId, { id: listId, name }));
      case "complete":
        if (!listId) return json({ ok: false, error: "listId is required to complete" });
        return json(await completeListCore(householdId, uid(extra), { listId, carryOver: carryOver ?? false }));
      case "delete":
        if (!listId) return json({ ok: false, error: "listId is required to delete" });
        return json(await deleteListCore(householdId, { id: listId }));
      case "duplicate":
        if (!listId) return json({ ok: false, error: "listId is required to duplicate" });
        return json(await duplicateListCore(householdId, uid(extra), { id: listId }));
    }
  },
);
```

- [ ] **Step 3: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: no type/lint errors. (The live smoke — seeding + calling each tool with a bearer — is run by the controller during verification.)

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): 4 list/shopping write tools (add_to_list/mark_list_item/edit_list_item/manage_list)"
```

---

## Verification (controller-run — needs the live DB)

After all tasks land, the controller runs a live smoke against Prisma Postgres (subagents only verify offline, since the tools require DB rows + a token).

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run` all clean; `npx next build` succeeds.

- [ ] **2. Live smoke** (`PORT=3001 npm run dev`, bearer from a seeded token — the Phase 5a smoke pattern): seed a household + user + token + a list (status active) + two catalog items. Then via `curl` against `/api/mcp` with the bearer:
  - `add_to_list {listId, itemId}` → a `ListItem` row appears (quantity 1, unit pcs).
  - `mark_list_item {listItemId, bought:true}` → `isBought=true`, `boughtById`=token user, `boughtAt` set; then `bought:false` → all cleared.
  - `edit_list_item {listItemId, quantity:3, unit:"kg", notes:"x"}` → row updated.
  - `manage_list create {name:"MCP List"}` → new draft list id returned; `rename` it; `duplicate` it (copy has the items); `complete {listId, carryOver:true}` on the seeded list → it goes `completed` and a "(carried over)" draft holds the unbought line; `delete` a list → gone with its lines.
  - **Scoping:** a `listId`/`listItemId`/`itemId` from another household is rejected with a not-found error.
  - **Web parity:** confirm the web actions still function (render `/lists` or exercise an action path) — the unchanged public types + a green `next build` are the primary guarantee.
  - Clean up all seeded rows afterward.

- [ ] **3. Final whole-branch review** (two-stage) over the Phase 5b-i range before pushing `next-migration`.

---

## Self-Review

**Spec coverage:** shared write-core extraction (util + list-items + lists cores) ✓ (Tasks 1–2); thin action wrappers preserving public types ✓ (Tasks 1–2); MCP-write foundation (`uid(extra)`) ✓ (Task 3); the 4 tools with ID-based inputs + `manage_list` action-dispatch ✓ (Task 3); `userId` only from the token ✓ (Task 3 tools pass `uid(extra)`, never tool input); destructive `delete` trusted-per-token with a warning description ✓; deferrals (no auto-track/ensureStoreTag/unit-price/remove-line tool) honored — none added ✓; unit test for `normalizeQuantity` ✓ (Task 1); household scoping preserved in the cores (gates moved, not copied) ✓; live smoke ✓.

**Placeholder scan:** No TBD/TODO. All code blocks are complete drop-in file contents or precise insertions. `manage_list`'s switch is exhaustive over the zod enum (no `default` needed; every case returns).

**Type consistency:** `Result` / `CreateResult` / `CompleteResult` shapes match between cores and the wrappers that re-expose them; `ResultWithList` (`{ ok: true; listId }`) is internal to the list-item core and consumed by the wrappers (which map it back to `Result`) and by the MCP tools (which JSON-serialize it, `listId` included — harmless). Core function names are used identically in Task 3's imports. `uid(extra)` mirrors the established `hh(extra)` accessor (`extra.authInfo.extra.userId`), which Phase 5a's verify callback populates.
