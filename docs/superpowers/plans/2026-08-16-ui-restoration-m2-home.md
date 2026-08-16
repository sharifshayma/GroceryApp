# M2 Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original **Home** screen — the app's main view — on the M1 foundation: search, Need-to-Buy + Frequently-Bought rows, a category-pill browser, item cards with photos, an add-to-list bottom sheet with stock management, tag/category filters, and multi-select bulk-add.

**Architecture:** Continue on branch `feat/ui-restoration` (M1 already merged into it). The original Home was a client-only Supabase SPA; the restoration splits it into a **server component** (`(app)/page.tsx`) that loads all household data via Prisma, and a **client** `HomeClient` that holds the interactive state and calls the existing **server actions** (`addListItem`, `createList`, `setStock`, …) directly, calling `router.refresh()` after mutations to reload server data. Components are ported 1:1 from the original but made **presentational** (tags/data arrive as props instead of client fetches).

**Tech Stack:** Next.js 16 (RSC + server actions), React 19, Prisma 6, Tailwind v4, Vitest 4, TypeScript. Bilingual via M1's `useT()` + `getItemName`/`getCategoryName`.

## Global Constraints

- **Branch:** `feat/ui-restoration` (do NOT merge to `main` — cutover is after M4). Personal git identity (`sharifshayma`).
- **No schema/backend changes, no migrations.** Reuse existing server actions and mutation cores. The only new data-layer code is one read query (`getFrequentlyBought`) and one thin composite action (`createListAndAddItem`).
- **Reference:** the original is `cb425ac:src-vite-legacy/` — match it. Home screen: `pages/Home.jsx`; components: `components/{ItemImage,ItemCard,HorizontalItemRow,AddToListModal}.jsx`.
- **RTL:** logical CSS properties only (`ps/pe/ms/me/start/end`), never physical. Use `useT()` for locale/`t`/`dir`; item + category display names via `getItemName`/`getCategoryName` from `@/lib/i18n-names`.
- **Theme tokens:** the restored palette (`primary`, `surface`, `bg`, `neutral`, `danger`, `text`, `text-secondary`, `green`) — already defined in M1. Original component class names map directly.
- **Data-field mapping (Supabase → Prisma), apply in every port:** `photo_url`→`photoUrl`, `default_unit`→`defaultUnit`, `name_he`→`nameHe`, `item_id`→`itemId`, `is_bought`→`isBought`, `list_items`→`items` (on a list), `low_threshold`→`lowThreshold`, `it.tags`→`it.tag` (an ItemTag's related tag). `getItemName(item)`/`getCategoryName(cat)` take a **second `locale` arg**.
- **Deferred (NOT in M2):** the original `AddToListModal` embedded a `PriceHistorySection`. Price display/logging is **deferred to the Prices milestone** — M2's modal covers stock + lists only. (Prices remain fully editable on the existing `/prices` page.) Item **edit/delete** actions are out of scope for the Home cards here (`showActions={false}`); item CRUD lives on the existing `/items` page until its own milestone.
- Each task ends `tsc`+`lint`+`build` clean (and `vitest` where tests exist).

---

## File Structure

**Create:**
- `src/lib/frequently-bought.ts` — pure `rankFrequentlyBought` helper (count/sort/limit).
- `src/lib/frequently-bought.test.ts` — unit tests.
- `src/actions/home.ts` — `createListAndAddItem` composite server action.
- `src/components/ItemImage.tsx`, `src/components/ItemCard.tsx`, `src/components/HorizontalItemRow.tsx` — ported presentational components.
- `src/components/BottomSheet.tsx` — shared sheet shell (backdrop + slide-up + safe-area).
- `src/components/AddToListModal.tsx` — the add-to-list + stock sheet.
- `src/components/home/HomeClient.tsx` — the Home screen's client shell (interactive state).
- `src/app/(app)/category/[id]/page.tsx` — single-category browse page.
- `src/lib/home-data.ts` — types shared between the loader and `HomeClient` (`HomeItem`, `OpenList`, `StockRow`, etc.).

**Modify:**
- `src/lib/mcp-queries.ts` — add `getFrequentlyBought(householdId, limit)`.
- `src/app/(app)/page.tsx` — replace the Home stub with the RSC data loader rendering `<HomeClient>`.

---

### Task 1: `getFrequentlyBought` query (+ pure ranking helper, TDD)

**Files:**
- Create: `src/lib/frequently-bought.ts`, `src/lib/frequently-bought.test.ts`
- Modify: `src/lib/mcp-queries.ts`

**Interfaces:**
- Produces: `rankFrequentlyBought(rows: { itemId: string }[], limit: number): { itemId: string; count: number }[]` — counts occurrences per `itemId`, returns the top `limit` by count (descending; ties broken by first-seen order for determinism). And `getFrequentlyBought(householdId: string, limit = 15): Promise<{ itemId: string; count: number }[]>` — queries bought list items for the household and ranks them.

- [ ] **Step 1: Write the failing test** — `src/lib/frequently-bought.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankFrequentlyBought } from "./frequently-bought";

describe("rankFrequentlyBought", () => {
  it("counts and sorts by frequency desc", () => {
    const rows = [{ itemId: "a" }, { itemId: "b" }, { itemId: "a" }, { itemId: "a" }, { itemId: "b" }, { itemId: "c" }];
    expect(rankFrequentlyBought(rows, 10)).toEqual([
      { itemId: "a", count: 3 },
      { itemId: "b", count: 2 },
      { itemId: "c", count: 1 },
    ]);
  });
  it("respects the limit", () => {
    const rows = [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }];
    expect(rankFrequentlyBought(rows, 2)).toHaveLength(2);
  });
  it("returns [] for no rows", () => {
    expect(rankFrequentlyBought([], 5)).toEqual([]);
  });
  it("breaks ties by first-seen order", () => {
    const rows = [{ itemId: "x" }, { itemId: "y" }];
    expect(rankFrequentlyBought(rows, 10)).toEqual([
      { itemId: "x", count: 1 },
      { itemId: "y", count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test → FAIL** — `npx vitest run src/lib/frequently-bought.test.ts` (module not found).

- [ ] **Step 3: Implement** — `src/lib/frequently-bought.ts`:

```ts
export function rankFrequentlyBought(
  rows: { itemId: string }[],
  limit: number,
): { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.itemId, (counts.get(r.itemId) ?? 0) + 1);
  // Map preserves first-seen insertion order, so a stable sort ties-break by it.
  return [...counts.entries()]
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Add the DB query** — append to `src/lib/mcp-queries.ts` (it already imports `prisma`):

```ts
import { rankFrequentlyBought } from "@/lib/frequently-bought";

export async function getFrequentlyBought(householdId: string, limit = 15) {
  const rows = await prisma.listItem.findMany({
    where: { list: { householdId }, isBought: true, itemId: { not: null } },
    select: { itemId: true },
  });
  return rankFrequentlyBought(
    rows.filter((r): r is { itemId: string } => r.itemId != null),
    limit,
  );
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit** — `git add src/lib/frequently-bought.ts src/lib/frequently-bought.test.ts src/lib/mcp-queries.ts && git commit -m "feat(home): getFrequentlyBought query + ranking helper"`

---

### Task 2: `createListAndAddItem` composite action

**Files:**
- Create: `src/actions/home.ts`

**Interfaces:**
- Consumes: `createListCore` and `addListItemCore` are the underlying cores; reuse the existing **actions** `createList`/`addListItem` is not composable (two revalidates) — instead call the cores directly for one transaction-like flow, mirroring `src/actions/lists.ts`.
- Produces: `createListAndAddItem(input: { name: string; itemId: string; quantity: number; unit: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }>` — creates a list then adds the item to it; revalidates `/` and `/lists`.

- [ ] **Step 1: Implement** — `src/actions/home.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household-context";
import { getCurrentUser } from "@/lib/auth-guard";
import { createListCore } from "@/lib/mutations/lists";
import { addListItemCore } from "@/lib/mutations/list-items";

export async function createListAndAddItem(input: {
  name: string;
  itemId: string;
  quantity: number;
  unit: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const household = await requireHousehold();
  const user = await getCurrentUser();
  const created = await createListCore(household.id, user?.id ?? null, { name: input.name });
  if (!created.ok) return created;
  const added = await addListItemCore(household.id, {
    listId: created.id,
    itemId: input.itemId,
    quantity: input.quantity,
    unit: input.unit,
  });
  if (!added.ok) return added;
  revalidatePath("/");
  revalidatePath("/lists");
  return { ok: true, id: created.id };
}
```

- [ ] **Step 2: Verify** — the core signatures are confirmed: `createListCore(householdId, userId, { name }) → { ok: true, id }` (`src/lib/mutations/lists.ts`) and `addListItemCore(householdId, { listId, itemId, quantity, unit, notes? }) → Result` (`src/lib/mutations/list-items.ts`) — the code above matches them exactly. Run `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/actions/home.ts && git commit -m "feat(home): createListAndAddItem composite action"`

---

### Task 3: `ItemImage` component (port)

**Files:**
- Create: `src/components/ItemImage.tsx`

**Interfaces:**
- Produces: `ItemImage({ item, size, className }: { item: { photoUrl?: string | null; emoji?: string | null; name: string; nameHe?: string | null }; size?: "sm" | "md" | "lg"; className?: string })`. Renders `<img src={photoUrl}>` when present (alt = `getItemName(item, locale)`), else the emoji in a sized box. Same `SIZES` map as the original.

- [ ] **Step 1: Port** `cb425ac:src-vite-legacy/components/ItemImage.jsx` → `src/components/ItemImage.tsx` with these changes: add `"use client"` (it needs `useT()` for the alt text locale); type the props as above; `item.photo_url` → `item.photoUrl`; import `useT` from `@/i18n/LocaleProvider` and `getItemName` from `@/lib/i18n-names`, and compute `alt={getItemName(item, locale)}`. Keep the `SIZES` map, `object-cover`, `bg-bg`, and emoji-fallback markup byte-identical otherwise.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/ItemImage.tsx && git commit -m "feat(home): ItemImage component (photo + emoji fallback)"`

---

### Task 4: `ItemCard` component (port, presentational)

**Files:**
- Create: `src/components/ItemCard.tsx`

**Interfaces:**
- Consumes: `ItemImage` (Task 3), `useT`, `getItemName`.
- Produces: `ItemCard({ item, isInList, showActions, selectMode, isSelected, onSelect, onAddToList })`. `item` includes `{ id, name, nameHe, emoji, defaultUnit, photoUrl, tags: { notes: string|null; tag: { id, name, color, type } }[] }`. Renders the card (image + name + unit label + up-to-3 tag pills). **Tags come from props — no data fetching.** For M2 `showActions` defaults to `false` (Home cards are add-to-list only; edit/delete deferred).

- [ ] **Step 1: Port** `cb425ac:src-vite-legacy/components/ItemCard.jsx` → `src/components/ItemCard.tsx` with these changes:
  - Add `"use client"`. Remove the `useEffect`/`supabase` tag fetch entirely — read tags from `item.tags` (prop) instead of local `itemTags` state.
  - Type props; `default_unit`→`defaultUnit`; `getItemName(item)`→`getItemName(item, locale)` (from `useT()`).
  - Tag pills: the original reads `it.tags?.color/type/name` from the joined `tags`; here each entry is `{ notes, tag: { name, color, type } }` — read `it.tag?.color`, `it.tag?.type`, `it.tag?.name`. Keep the recipe/store/custom emoji logic (`🍽️`/`🏪`/`🏷️`) and the "+N" overflow.
  - Unit label: the original does `t(\`units.${item.default_unit}\`, item.default_unit)`. The new `t(path)` returns the path when missing, so use `t(\`units.${item.defaultUnit}\`)` and if that returns the raw path, fall back to `item.defaultUnit`: `const unit = t(\`units.${item.defaultUnit}\`); ... {unit.startsWith("units.") ? item.defaultUnit : unit}`.
  - Keep the `IconCheckCircle`/`IconEdit`/`IconTrash` usage ONLY under `showActions`; since M2 passes `showActions={false}`, you still must import them — **add `IconCheckCircle`, `IconEdit`, `IconTrash` to `src/components/Icons.tsx`** (port their SVG bodies from `cb425ac:src-vite-legacy/components/Icons.jsx`) as part of this task.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/ItemCard.tsx src/components/Icons.tsx && git commit -m "feat(home): ItemCard component (presentational, tags via props)"`

---

### Task 5: `HorizontalItemRow` component (port)

**Files:**
- Create: `src/components/HorizontalItemRow.tsx`

**Interfaces:**
- Consumes: `ItemImage`, `useT`, `getItemName`, `IconChevronDown`.
- Produces: `HorizontalItemRow({ title, icon, items, accentClass, onItemClick, itemsInList, collapsed, onToggleCollapse })` — a horizontally-scrolling row of item tiles; returns `null` when `items` is empty. `itemsInList` is a `Set<string>`.

- [ ] **Step 1: Port** `cb425ac:src-vite-legacy/components/HorizontalItemRow.jsx` → `src/components/HorizontalItemRow.tsx`: add `"use client"`; type props; `getItemName(item)`→`getItemName(item, locale)`; keep `no-scrollbar`, `border-t-2 {accentClass}`, the collapse chevron, and the `🛒` in-list marker (`top-1 end-1`). Add `IconChevronDown` to `src/components/Icons.tsx` if not already present (port from the original Icons.jsx).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/HorizontalItemRow.tsx src/components/Icons.tsx && git commit -m "feat(home): HorizontalItemRow component"`

---

### Task 6: `BottomSheet` primitive

**Files:**
- Create: `src/components/BottomSheet.tsx`

**Interfaces:**
- Produces: `BottomSheet({ onClose, children, className }: { onClose: () => void; children: React.ReactNode; className?: string })` — the shared sheet shell: fixed inset, `bg-black/50 animate-backdrop` backdrop (click → `onClose`), and a bottom-anchored panel `bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in` with `paddingBottom: env(safe-area-inset-bottom, 16px)`. Extracts the wrapper markup used by the original `AddToListModal` and list-picker so both reuse it.

- [ ] **Step 1: Implement** — `src/components/BottomSheet.tsx`:

```tsx
"use client";

export function BottomSheet({
  onClose,
  children,
  className = "",
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onClose} />
      <div
        className={`relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-slide-up sm:animate-fade-in ${className}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git add src/components/BottomSheet.tsx && git commit -m "feat(home): BottomSheet primitive"`

---

### Task 7: `AddToListModal` (port; stock + lists via server actions)

**Files:**
- Create: `src/components/AddToListModal.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `useT`, `getItemName`, and the server actions `addListItem`, `removeListItem`, `setStock` (`@/actions/*`) and `createListAndAddItem` (`@/actions/home`), plus `useRouter().refresh()`.
- Produces: `AddToListModal({ item, openLists, stockRow, onClose })` where `item = { id, name, nameHe, emoji, defaultUnit }`, `openLists = { id, name, status, itemIds: string[] }[]`, `stockRow = { quantity, unit, lowThreshold } | null`. Two steps (`quantity` / `pickList`); adds to a list, creates-and-adds a new list, removes from a list, and views/edits stock. After any mutation, calls `router.refresh()` then `onClose()` (or stays open for stock edits).

- [ ] **Step 1: Port** `cb425ac:src-vite-legacy/components/AddToListModal.jsx` → `src/components/AddToListModal.tsx`, with these adaptations:
  - Wrap the panel in `<BottomSheet onClose={onClose}>` (Task 6) instead of the inline backdrop/panel markup; keep the header + body inside it.
  - Add `"use client"`; type props as above. Replace `useTranslation`/`i18n.language` with `useT()` (`const { t, locale } = useT()`, `isHe = locale === "he"`), and `getItemName(item)` → `getItemName(item, locale)`.
  - **Lists model:** the original reads `list.list_items` and `li.item_id`. Here each open list is `{ id, name, status, itemIds }`. `listHasItem(list) = list.itemIds.includes(item.id)`. `openLists` is already only open lists (the loader filters), so drop the `status` re-filter. The list-item count shown becomes `list.itemIds.length`.
  - **Wire callbacks to server actions** (replace the prop callbacks):
    - Add to existing list: `await addListItem({ listId, itemId: item.id, quantity: 1, unit: item.defaultUnit || "pcs" })`.
    - Create & add: `const name = \`${t("nav.lists")} — ${new Date().toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" })}\`; await createListAndAddItem({ name, itemId: item.id, quantity: 1, unit: item.defaultUnit || "pcs" })`.
    - Remove from list: `await removeListItem(listItemId)` — but the new `openLists.itemIds` doesn't carry the listItemId. **Change `openLists` shape to `{ id, name, status, items: { listItemId: string; itemId: string }[] }`** so removal has the id (`const li = list.items.find(x => x.itemId === item.id)`). Update `listHasItem` to `list.items.some(x => x.itemId === item.id)` and the count to `list.items.length`.
    - Stock (view/edit/track): the original has three callbacks (`onAddToStock`, `onUpdateStockQuantity`, `onUpdateStockThreshold`). The new `setStock({ itemId, quantity, unit, lowThreshold })` is an **upsert** that covers all three. Replace `commitStockQty`/`commitThreshold`/`saveNewStock` so each calls `await setStock({ itemId: item.id, quantity: <newQty>, unit: stockRow?.unit || item.defaultUnit || "pcs", lowThreshold: <threshold> })`. Keep the local `stockQty`/`stockThreshold`/`trackingExpanded` state and the +/− controls exactly.
  - **Remove the `PriceHistorySection` import and its `<PriceHistorySection .../>` usage** — price display is deferred (see Global Constraints). Leave the stock and lists sections intact.
  - After any successful mutation call `router.refresh()`; for add/create/remove also `onClose()`. For stock edits, keep the sheet open (the refreshed `stockRow` prop re-syncs via the existing `useEffect`).
  - Keep ALL the visual markup (stock card, quantity steppers, list rows, CTAs, Hebrew/English strings) byte-faithful to the original.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. (The modal isn't mounted until Task 8.)

- [ ] **Step 3: Commit** — `git add src/components/AddToListModal.tsx && git commit -m "feat(home): AddToListModal (stock + lists via server actions)"`

---

### Task 8: Home RSC loader + `HomeClient` default view

**Files:**
- Create: `src/lib/home-data.ts`, `src/components/home/HomeClient.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: everything above, plus `getNeedToBuy`, `getFrequentlyBought` (`@/lib/mcp-queries`).
- Produces: the working Home — Need-to-Buy 🔴 + Frequently-Bought ⭐ rows and the category-pill browser rendering `ItemCard`s, tapping an item opens `AddToListModal`. Search/filters/multi-select come in Tasks 9–10.

- [ ] **Step 1: Shared types** — `src/lib/home-data.ts`:

```ts
export type HomeItem = {
  id: string; name: string; nameHe: string | null; emoji: string;
  defaultUnit: string; notes: string | null; categoryId: string | null; photoUrl: string | null;
  tags: { notes: string | null; tag: { id: string; name: string; color: string; type: "recipe" | "store" | "custom" } }[];
};
export type HomeCategory = { id: string; name: string; nameHe: string | null; emoji: string };
export type HomeTag = { id: string; name: string; color: string; type: "recipe" | "store" | "custom" };
export type OpenList = { id: string; name: string; status: "draft" | "active"; items: { listItemId: string; itemId: string }[] };
export type StockRow = { itemId: string; quantity: number; unit: string; lowThreshold: number };
```

- [ ] **Step 2: RSC loader** — replace `src/app/(app)/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { getNeedToBuy, getFrequentlyBought } from "@/lib/mcp-queries";
import { HomeClient } from "@/components/home/HomeClient";
import type { HomeItem, OpenList, StockRow } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const household = await requireHousehold();
  const [items, categories, tags, stock, openLists, need, frequent] = await Promise.all([
    prisma.item.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, nameHe: true, emoji: true, defaultUnit: true, notes: true,
        categoryId: true, photoUrl: true,
        tags: { select: { notes: true, tag: { select: { id: true, name: true, color: true, type: true } } } },
      },
    }),
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, nameHe: true, emoji: true } }),
    prisma.tag.findMany({ where: { householdId: household.id }, orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, type: true } }),
    prisma.stock.findMany({ where: { householdId: household.id },
      select: { itemId: true, quantity: true, unit: true, lowThreshold: true } }),
    prisma.groceryList.findMany({
      where: { householdId: household.id, status: { in: ["draft", "active"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, items: { select: { id: true, itemId: true } } },
    }),
    getNeedToBuy(household.id),
    getFrequentlyBought(household.id),
  ]);

  const itemsById = new Map((items as HomeItem[]).map((i) => [i.id, i]));
  const needItems = need.entries.map((e) => itemsById.get(e.item.id)).filter(Boolean) as HomeItem[];
  const frequentItems = frequent.map((f) => itemsById.get(f.itemId)).filter(Boolean) as HomeItem[];
  const stockRows: StockRow[] = stock.map((s) => ({ itemId: s.itemId, quantity: s.quantity, unit: s.unit, lowThreshold: s.lowThreshold }));
  const lists: OpenList[] = openLists.map((l) => ({
    id: l.id, name: l.name, status: l.status as "draft" | "active",
    items: l.items.filter((li) => li.itemId != null).map((li) => ({ listItemId: li.id, itemId: li.itemId as string })),
  }));

  return (
    <HomeClient
      items={items as HomeItem[]}
      categories={categories}
      tags={tags}
      stockRows={stockRows}
      openLists={lists}
      needToBuy={needItems}
      frequentlyBought={frequentItems}
    />
  );
}
```

- [ ] **Step 3: HomeClient (default view only)** — `src/components/home/HomeClient.tsx`. Port the DEFAULT-VIEW section of `cb425ac:src-vite-legacy/pages/Home.jsx` (the block under `{!searchResults && !activeTag && !activeCategory && (...)}` plus the header) into a client component with this shape (search/filter/select state stubbed to defaults for now, wired in Tasks 9–10):

```tsx
"use client";

import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { getCategoryName } from "@/lib/i18n-names";
import { HorizontalItemRow } from "@/components/HorizontalItemRow";
import { ItemCard } from "@/components/ItemCard";
import { AddToListModal } from "@/components/AddToListModal";
import type { HomeItem, HomeCategory, HomeTag, OpenList, StockRow } from "@/lib/home-data";

export function HomeClient(props: {
  items: HomeItem[]; categories: HomeCategory[]; tags: HomeTag[];
  stockRows: StockRow[]; openLists: OpenList[]; needToBuy: HomeItem[]; frequentlyBought: HomeItem[];
}) {
  const { t, locale } = useT();
  const [homeCategoryId, setHomeCategoryId] = useState<string | null>(props.categories[0]?.id ?? null);
  const [addToListItem, setAddToListItem] = useState<HomeItem | null>(null);

  const itemsInList = new Set(props.openLists.flatMap((l) => l.items.map((i) => i.itemId)));
  const stockByItem = new Map(props.stockRows.map((s) => [s.itemId, s]));
  const homeCategoryItems = homeCategoryId ? props.items.filter((i) => i.categoryId === homeCategoryId) : [];

  return (
    <div className="px-4 pt-6 pb-8 animate-fade-in">
      <h1 className="text-2xl font-semibold mb-4">{locale === "he" ? "פריטים" : "Items"}</h1>

      <HorizontalItemRow title={locale === "he" ? "צריך לקנות" : "Need to Buy"} icon="🔴"
        items={props.needToBuy} accentClass="border-t-danger" itemsInList={itemsInList}
        onItemClick={(item) => setAddToListItem(item)} />
      <HorizontalItemRow title={locale === "he" ? "קונים הרבה" : "Frequently Bought"} icon="⭐"
        items={props.frequentlyBought} accentClass="border-t-secondary" itemsInList={itemsInList}
        onItemClick={(item) => setAddToListItem(item)} />

      {/* Category pill browser */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 -mx-4 px-4">
        {props.categories.map((cat) => (
          <button key={cat.id} onClick={() => setHomeCategoryId(cat.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
              cat.id === homeCategoryId ? "bg-primary text-white" : "bg-white text-text-secondary border border-neutral/30 hover:text-text"}`}>
            {cat.emoji} {getCategoryName(cat, locale)}
          </button>
        ))}
      </div>
      {homeCategoryItems.length === 0 ? (
        <div className="text-center py-12"><p className="text-text-secondary">{t("catalog.empty") /* or a Home-specific empty string */}</p></div>
      ) : (
        <div className="space-y-2">
          {homeCategoryItems.map((item) => (
            <ItemCard key={item.id} item={item} showActions={false}
              isInList={itemsInList.has(item.id)} onAddToList={() => setAddToListItem(item)} />
          ))}
        </div>
      )}

      {addToListItem && (
        <AddToListModal item={addToListItem} openLists={props.openLists}
          stockRow={stockByItem.get(addToListItem.id) ?? null} onClose={() => setAddToListItem(null)} />
      )}
    </div>
  );
}
```

Keep the original's `HorizontalItemRow` collapse behavior deferred (no `collapsed` props here in M2 v1; add later if desired). Add any missing dictionary strings you reference (e.g. an empty-state string) to both `en.ts`/`he.ts`.

- [ ] **Step 4: Build + live smoke** — `npm run build` clean, then `PORT=3011 npm run dev`; signed in as `demo@grocery.app` at `/`: the two rows render with photos/emoji, the category pills switch the item list, tapping an item opens the sheet, adding it to a list works and the 🛒 marker appears after refresh.

- [ ] **Step 5: Commit** — `git add "src/app/(app)/page.tsx" src/lib/home-data.ts src/components/home/HomeClient.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts && git commit -m "feat(home): Home RSC loader + default view (rows + category browser + add-to-list)"`

---

### Task 9: Search + filter chips

**Files:**
- Modify: `src/components/home/HomeClient.tsx`
- Modify: `src/components/Icons.tsx` (add `IconSearch`, `IconSettings`, `IconChevronRight` — port from the original Icons.jsx)

**Interfaces:**
- Produces: the search bar (filters `items` by `name`/`nameHe`/`notes`), the Categories dropdown pill, and the Tag-type chips (Recipes 🍽️ / Stores 🏪 / Custom 🏷️, from `tags` grouped by `type`, colored by `tag.color`), plus a settings gear linking to Manage Categories / Manage Tags. Category and tag filters are mutually exclusive; selecting one renders its filtered `ItemCard` list (via the same `renderItemCard`/tap-to-open flow).

- [ ] **Step 1: Port** the header + search + filter-row + `activeTag`/`activeCategory` result sections from `cb425ac:src-vite-legacy/pages/Home.jsx` into `HomeClient`, adding the `search`, `activeCategory`, `activeTag`, `showCategoryDropdown`, `expandedTagType`, `showSettings` state. Reuse the mapping rules (Global Constraints). Tag filtering needs each item's tag ids — use `item.tags.map(t => t.tag.id)` (no fetch; the loader already includes tags). The Manage Categories/Tags links point at `/categories` and `/tags` (existing routes; folded into Profile later). Click-outside handling: port the original `useEffect` mousedown logic.

- [ ] **Step 2: Build + smoke** — `npm run build` clean; dev: typing filters items; the Categories dropdown + tag chips filter; selecting a category/tag shows its items; clearing returns to the default view.

- [ ] **Step 3: Commit** — `git add "src/components/home/HomeClient.tsx" src/components/Icons.tsx && git commit -m "feat(home): search + category/tag filter chips"`

---

### Task 10: Multi-select mode + bulk add + list-picker sheet

**Files:**
- Modify: `src/components/home/HomeClient.tsx`

**Interfaces:**
- Produces: a Select-mode toggle (visible on filtered views), a selection `Map<string, HomeItem>`, checkbox affordances on cards, a floating "Add N items to list" button, and a list-picker `BottomSheet` (choose an open list or create a new one). Bulk-add skips items already on the target list, using `addListItem` per item (and `createListAndAddItem` for the first item of a new list, then `addListItem` for the rest) + `router.refresh()`.

- [ ] **Step 1: Port** the multi-select + `handleBulkAdd` + `showListPicker` sections from the original `Home.jsx` into `HomeClient`, wiring the bulk writes to the server actions (loop `addListItem`; for a brand-new list, call `createListAndAddItem` for the first item then `addListItem` for the remainder). Use `BottomSheet` for the list picker. Keep the checkbox styling and the floating CTA (`fixed bottom-20`, safe-area) from the original.

- [ ] **Step 2: Build + smoke** — `npm run build` clean; dev: enter Select on a filtered view, pick several items, bulk-add to an existing list and to a new list; duplicates are skipped; the count/label is correct in both locales.

- [ ] **Step 3: Commit** — `git add "src/components/home/HomeClient.tsx" && git commit -m "feat(home): multi-select bulk add + list picker"`

---

### Task 11: Category page (`/category/[id]`)

**Files:**
- Create: `src/app/(app)/category/[id]/page.tsx`

**Interfaces:**
- Produces: a single category's items as `ItemCard`s (tap → add-to-list). The Home tab stays active for `/category/*` (M1's TabBar already treats `/category` as Home).

- [ ] **Step 1: Implement** — an RSC that loads the category + its items (same item `select` as Task 8) + `openLists` + `stockRows`, and renders a small client wrapper reusing `ItemCard` + `AddToListModal` (extract the card-list + modal portion of `HomeClient` into a shared `ItemCardList` client component if convenient, or inline a minimal client wrapper). Guard: unknown/foreign category id → `notFound()`. Header shows `{emoji} {getCategoryName(cat, locale)}`.

- [ ] **Step 2: Build + smoke** — `npm run build` clean; dev: navigating to a category shows its items; tapping opens the sheet; the Home tab remains highlighted.

- [ ] **Step 3: Commit** — `git add "src/app/(app)/category/[id]/page.tsx" && git commit -m "feat(home): category browse page"`

---

## Self-Review

**Spec coverage (M2 row):** main screen (Tasks 8–9) ✓; item components ItemImage/ItemCard/HorizontalItemRow (3–5) ✓; add-to-list sheet with stock (6–7) ✓; bulk add (10) ✓; `getFrequentlyBought` (1) ✓; category browse (11) ✓; Need-to-Buy + Frequently rows + category browser (8) ✓; tag/category filters (9) ✓.

**Deferred (flagged, intentional):** price display in the modal → Prices milestone; item edit/delete on cards → items milestone; `HorizontalItemRow` collapse persistence (optional polish). These are called out in Global Constraints, not silently dropped.

**Type consistency:** `HomeItem`/`OpenList`/`StockRow` (Task 8 `home-data.ts`) are the shared contract used by `ItemCard`, `HorizontalItemRow`, `AddToListModal`, and `HomeClient`. `AddToListModal` requires `openLists[].items[].listItemId` (Task 7 note) — Task 8's loader provides exactly that. `getFrequentlyBought` returns `{ itemId, count }[]` (Task 1) → Task 8 maps to full items. Tag pill fields (`it.tag.type/color/name`) match the loader's `tags: { notes, tag: { id, name, color, type } }` select.

**Verify-before-relying:** `createListCore(householdId, userId, {name}) → {ok, id}` and `addListItemCore(householdId, {listId, itemId, quantity, unit, notes?}) → Result` — **confirmed** against `src/lib/mutations/*` (Task 2 code matches). `getNeedToBuy` returns `{ entries: { item: { id } }[], lowCount, onListCount }` — confirmed in `src/lib/mcp-queries.ts` (Task 8 maps `entries[].item.id` to full loaded items). No open placeholders.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-ui-restoration-m2-home.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
