# GroceryApp Phase 6d — Item Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload / display / replace / remove item photos via Vercel Blob, and migrate the 6 existing photos off Supabase storage into Blob.

**Architecture:** Client-upload (`@vercel/blob/client` `upload()`) through an auth'd token route (`/api/photo/upload`) that verifies household item ownership; a household-scoped server action persists the Blob URL/pathname; the item list + edit form show the photo. A one-off script moves the 6 Supabase-hosted photos into Blob.

**Tech Stack:** Next.js 16, `@vercel/blob`, Prisma 6, Vitest 4, TypeScript.

## Global Constraints

- Branch `next-migration`, never `main`. Personal git identity (`sharifshayma`). Never commit `.env`.
- Lint is **`npm run lint`**. No schema changes (`Item.photoUrl`/`photoPath` exist). No MCP changes.
- `BLOB_READ_WRITE_TOKEN` is in `.env` (already verified present). The `@vercel/blob` SDK reads it from env.
- Uploads are authorized only for a logged-in user's OWN household item (checked in the token route). Content-type restricted to images; size ≤ 5 MB.
- Blob deletes on replace/remove are best-effort (`.catch`) — a missing/foreign blob must never fail the DB write.
- Migration is READ-ONLY on Supabase (fetches public image URLs), idempotent (skips items already on the Blob host).
- i18n `he: typeof en` parity for any new key.
- `Result = { ok: true } | { ok: false; error: string }`.

> **External-API note:** `@vercel/blob` exact exports/signatures (`handleUpload`, `type HandleUploadBody`, `upload` from `@vercel/blob/client`; `put`, `del` from `@vercel/blob`) should be confirmed against the INSTALLED package types and adjusted if they differ — same "verify installed types" discipline used for `mcp-handler` in Phase 5a.

---

## File Structure

- `package.json` — add `@vercel/blob` (Task 1).
- `src/lib/blob.ts` (+ test) — `isBlobUrl` (Task 1).
- `src/app/api/photo/upload/route.ts` — token route (Task 1).
- `src/actions/photos.ts` — `setItemPhoto` / `removeItemPhoto` (Task 1).
- `src/components/ItemPhotoField.tsx` — the upload/preview/remove control (Task 2).
- `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`, `src/i18n/dictionaries/{en,he}.ts` — display + wire-in (Task 2).
- `scripts/migrate-photos.ts` — move the 6 (Task 3).

---

## Task 1: Blob plumbing — deps, `isBlobUrl`, upload route, photo actions

**Files:** Modify `package.json`; Create `src/lib/blob.ts`, `src/lib/blob.test.ts`, `src/app/api/photo/upload/route.ts`, `src/actions/photos.ts`.

**Interfaces — Produces:** `isBlobUrl(url: string): boolean`; `POST /api/photo/upload`; `setItemPhoto({ itemId, url, pathname }): Promise<Result>`; `removeItemPhoto(itemId): Promise<Result>`.

- [ ] **Step 1: Add the dep**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npm install @vercel/blob`

- [ ] **Step 2: Write the failing test for `isBlobUrl`**

Create `src/lib/blob.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isBlobUrl } from "./blob";

describe("isBlobUrl", () => {
  it("true for a Vercel Blob URL", () => {
    expect(isBlobUrl("https://abc123.public.blob.vercel-storage.com/items/x.jpg")).toBe(true);
  });
  it("false for a Supabase storage URL", () => {
    expect(isBlobUrl("https://wvuazvbcraztswoxfbwi.supabase.co/storage/v1/object/public/i/x.jpg")).toBe(false);
  });
  it("false for junk / empty", () => {
    expect(isBlobUrl("")).toBe(false);
    expect(isBlobUrl("not a url")).toBe(false);
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/blob.test.ts`
Expected: FAIL (cannot resolve `./blob`).

- [ ] **Step 4: Write `isBlobUrl`**

Create `src/lib/blob.ts`:

```ts
export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).host.endsWith("blob.vercel-storage.com");
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run → pass**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/blob.test.ts`
Expected: PASS.

- [ ] **Step 6: Upload token route**

Create `src/app/api/photo/upload/route.ts` (confirm `handleUpload`/`HandleUploadBody` import path against the installed `@vercel/blob` types):

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/household-context";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const household = await requireHousehold(); // throws if unauthenticated / no household
        const { itemId } = JSON.parse(clientPayload ?? "{}") as { itemId?: string };
        if (!itemId) throw new Error("Missing itemId");
        const item = await prisma.item.findFirst({
          where: { id: itemId, householdId: household.id },
          select: { id: true },
        });
        if (!item) throw new Error("Item not found");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5_000_000,
        };
      },
      onUploadCompleted: async () => {
        // Persistence happens via the setItemPhoto action after the client upload resolves
        // (reliable in local dev, where Blob can't call back to localhost).
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 7: Photo actions**

Create `src/actions/photos.ts`:

```ts
"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHousehold } from "@/lib/household-context";
import { isBlobUrl } from "@/lib/blob";

type Result = { ok: true } | { ok: false; error: string };

async function ownedItem(householdId: string, itemId: string) {
  return prisma.item.findFirst({
    where: { id: itemId, householdId },
    select: { id: true, photoUrl: true },
  });
}

export async function setItemPhoto(input: {
  itemId: string;
  url: string;
  pathname: string;
}): Promise<Result> {
  const household = await requireHousehold();
  const item = await ownedItem(household.id, input.itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (item.photoUrl && isBlobUrl(item.photoUrl)) await del(item.photoUrl).catch(() => {});
  await prisma.item.update({
    where: { id: input.itemId },
    data: { photoUrl: input.url, photoPath: input.pathname },
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function removeItemPhoto(itemId: string): Promise<Result> {
  const household = await requireHousehold();
  const item = await ownedItem(household.id, itemId);
  if (!item) return { ok: false, error: "Item not found" };
  if (item.photoUrl && isBlobUrl(item.photoUrl)) await del(item.photoUrl).catch(() => {});
  await prisma.item.update({
    where: { id: itemId },
    data: { photoUrl: null, photoPath: null },
  });
  revalidatePath("/items");
  return { ok: true };
}
```

- [ ] **Step 8: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx vitest run src/lib/blob.test.ts && npx tsc --noEmit && npm run lint`
Expected: test PASS; no type/lint errors.

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add package.json package-lock.json src/lib/blob.ts src/lib/blob.test.ts src/app/api/photo/upload/route.ts src/actions/photos.ts
git commit -m "feat(photos): Blob upload token route + set/remove item photo actions"
```

---

## Task 2: Item photo UI — upload control, thumbnails, form wire-in

**Files:** Create `src/components/ItemPhotoField.tsx`; Modify `src/app/(app)/items/page.tsx`, `src/components/ItemManager.tsx`, `src/i18n/dictionaries/{en,he}.ts`.

**Interfaces — Consumes:** `upload` (`@vercel/blob/client`), `setItemPhoto`/`removeItemPhoto` (Task 1).

- [ ] **Step 1: The photo control**

Create `src/components/ItemPhotoField.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { setItemPhoto, removeItemPhoto } from "@/actions/photos";
import { getDictionary, t } from "@/i18n";

const d = getDictionary("en");

export function ItemPhotoField({ itemId, photoUrl }: { itemId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/photo/upload",
        clientPayload: JSON.stringify({ itemId }),
      });
      const res = await setItemPhoto({ itemId, url: blob.url, pathname: blob.pathname });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    const res = await removeItemPhoto(itemId);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-ink">{t(d, "catalog.items.photo")}</span>
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border text-ink/40">
            —
          </div>
        )}
        <div className="flex flex-col gap-1">
          <input type="file" accept="image/*" disabled={busy} onChange={onFile} className="text-sm" />
          {photoUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-left text-sm text-red-600 hover:underline"
            >
              {t(d, "catalog.items.removePhoto")}
            </button>
          )}
        </div>
      </div>
      {busy && <p className="text-sm text-ink/60">{t(d, "catalog.items.uploading")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Page fetch + row type**

- `src/app/(app)/items/page.tsx`: add `photoUrl: true,` to the item `select`.
- `src/components/ItemManager.tsx`: `ItemRow` gains `photoUrl: string | null;`; add `import { ItemPhotoField } from "@/components/ItemPhotoField";`

- [ ] **Step 3: Row thumbnail**

In `src/components/ItemManager.tsx`, replace the row emoji span (`<span className="text-2xl">{row.emoji}</span>`) with:

```tsx
{row.photoUrl ? (
  <img src={row.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
) : (
  <span className="text-2xl">{row.emoji}</span>
)}
```

- [ ] **Step 4: Form photo block (edit only)**

In the item form (inside the modal), after the notes/autoTrack fields and before the form error, add — only when editing an existing item (photo needs an `itemId`):

```tsx
{editingId && (
  <ItemPhotoField
    itemId={editingId}
    photoUrl={items.find((r) => r.id === editingId)?.photoUrl ?? null}
  />
)}
```

- [ ] **Step 5: i18n**

Add to `catalog.items` in BOTH dictionaries:
- `en.ts`: `photo: "Photo", removePhoto: "Remove photo", uploading: "Uploading…",`
- `he.ts`: `photo: "תמונה", removePhoto: "הסר תמונה", uploading: "מעלה…",`

- [ ] **Step 6: Verify + commit**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint && npx next build`
Expected: clean; builds (the `/api/photo/upload` route + the client component compile).

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add src/components/ItemPhotoField.tsx src/app/\(app\)/items/page.tsx src/components/ItemManager.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(photos): item photo upload/preview/remove in the item form + row thumbnails"
```

---

## Task 3: Migrate the 6 existing photos into Blob

**Files:** Create `scripts/migrate-photos.ts`.

**Interfaces — Consumes:** `put` (`@vercel/blob`), `isBlobUrl` (`../src/lib/blob`).

- [ ] **Step 1: The script**

Create `scripts/migrate-photos.ts` (own `PrismaClient`, relative import; run with `node --env-file=.env --import tsx`):

```ts
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { isBlobUrl } from "../src/lib/blob";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.item.findMany({
    where: { photoUrl: { not: null } },
    select: { id: true, name: true, photoUrl: true },
  });
  let moved = 0;
  let skipped = 0;
  for (const it of items) {
    if (!it.photoUrl || isBlobUrl(it.photoUrl)) {
      skipped++;
      continue;
    }
    const resp = await fetch(it.photoUrl);
    if (!resp.ok) {
      console.warn(`⚠️  skip (fetch ${resp.status}) ${it.name}`);
      continue;
    }
    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    const ext = (contentType.split("/")[1] ?? "jpg").split(";")[0];
    const buf = Buffer.from(await resp.arrayBuffer());
    const blob = await put(`items/${it.id}.${ext}`, buf, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    await prisma.item.update({
      where: { id: it.id },
      data: { photoUrl: blob.url, photoPath: blob.pathname },
    });
    moved++;
    console.log(`moved ${it.name} → ${blob.url}`);
  }
  console.log(`✅ photos migrated: ${moved}, skipped (already Blob/none): ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ photo migration failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/balanceshayma/Documents/GitHub/GroceryApp && npx tsc --noEmit && npm run lint`
Expected: clean. (Running it against the live DB + Blob is the controller's verification step.)

- [ ] **Step 3: Commit**

```bash
cd /Users/balanceshayma/Documents/GitHub/GroceryApp
git add scripts/migrate-photos.ts
git commit -m "feat(photos): one-off script to migrate existing photos from Supabase to Blob"
```

---

## Verification (controller-run — needs the live DB + Blob token)

- [ ] **1. Offline gate:** `npx tsc --noEmit && npm run lint && npx vitest run && npx next build` all clean.

- [ ] **2. Auth gate on the route:** an UNauthenticated `POST /api/photo/upload` (no session cookie) is rejected (the `requireHousehold()` throw → 400, not a token). Quick `curl` check against a running dev server.

- [ ] **3. Migrate the 6:** `node --env-file=.env --import tsx scripts/migrate-photos.ts` → prints "moved" for the 6 Supabase-hosted photos, "skipped" for any already on Blob. Then verify in the DB: the 6 items' `photoUrl` now `isBlobUrl` (host ends `blob.vercel-storage.com`) and each new URL `fetch`es to HTTP 200 (image loads). Re-run once → all skipped (idempotent).

- [ ] **4. Upload/persist round-trip** (scripted, since the browser is localhost-sandboxed): seed a test item; `put()` a tiny test image to Blob and call the `setItemPhoto` DB effect (or drive the action via a `node --env-file=.env --import tsx` script that replicates it) → the item's `photoUrl` is on Blob and loads; `removeItemPhoto` → fields cleared + blob gone. Clean up the test item + its blob.

- [ ] **5. Final whole-branch review** (most capable model) over the Phase 6d range; then push `next-migration`.

---

## Self-Review

**Spec coverage:** `@vercel/blob` + `isBlobUrl` (TDD) ✓ (Task 1); auth'd upload token route verifying household item ownership + content-type/size limits ✓ (Task 1); `setItemPhoto`/`removeItemPhoto` household-scoped with best-effort old-blob `del` ✓ (Task 1); client-upload control + row thumbnails + edit-form photo block (edit-only) + i18n ✓ (Task 2); one-off idempotent Supabase→Blob migration for the 6, read-only on Supabase ✓ (Task 3); no schema/MCP changes ✓; unit test for `isBlobUrl` ✓; live verification (auth gate, migration, upload round-trip) ✓.

**Placeholder scan:** No TBD/TODO. The `@vercel/blob` "confirm installed types" note is a bounded external-API instruction (as in Phase 5a), resolved during Task 1's build. The verification's "drive the action via a script" is a concrete controller technique for the sandboxed-browser constraint, not a gap.

**Type consistency:** `isBlobUrl(url: string): boolean` used identically in the actions and the migration. `setItemPhoto({ itemId, url, pathname })` / `removeItemPhoto(itemId)` match `ItemPhotoField`'s calls (`{ itemId, url: blob.url, pathname: blob.pathname }`). The upload `clientPayload` `{ itemId }` matches the route's `JSON.parse(clientPayload)`. `ItemRow.photoUrl: string | null` matches the page `select` addition and the row/form reads. i18n keys `photo`/`removePhoto`/`uploading` added to both dicts.
