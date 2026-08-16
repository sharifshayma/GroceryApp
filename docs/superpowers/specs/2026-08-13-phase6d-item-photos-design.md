# GroceryApp Migration — Phase 6d (Item photos) design

**Date:** 2026-08-13
**Status:** Design, pending user review
**Depends on:** Phases 1–6c — complete. `Item.photoUrl`/`photoPath` already in the schema.

## Scope

Give items **photos** on the new stack: upload/replace/remove an item photo (stored in **Vercel Blob**),
display it on the item list + edit form, and **migrate the 6 existing photos** off Supabase storage (whose
URLs die at cutover) into Blob. Item photos only — categories have 0 photos and stay deferred; photos are
not an MCP concern (no tool changes).

## Decisions

- **Vercel Blob**, `access: "public"` (images must be viewable), via `@vercel/blob`. Token
  `BLOB_READ_WRITE_TOKEN` (already in `.env`).
- **Client-upload** (`@vercel/blob/client` `upload()`), NOT a server-action upload — photos exceed the
  ~1 MB server-action body limit; the browser uploads straight to Blob via an auth'd token route.
- Plain `<img>` thumbnails (no `next/image` remote-host config).
- Replace/remove **deletes the old blob** (`del()`), so we don't orphan storage.
- No schema changes (`photoUrl`/`photoPath` exist); no MCP changes.

## Components

### 1. Deps + config

- Add `@vercel/blob`. `BLOB_READ_WRITE_TOKEN` read from env by the SDK.

### 2. Upload token route — `src/app/api/photo/upload/route.ts`

A `POST` handler wrapping `@vercel/blob/client`'s `handleUpload`:
- `onBeforeGenerateToken(pathname, clientPayload)` — resolve `requireHousehold()` (cookies flow on the
  same-origin request, so the session is available); parse `clientPayload` = `{ itemId }`; **verify the
  item belongs to the household** (else throw → upload denied). Return
  `{ allowedContentTypes: ["image/jpeg","image/png","image/webp","image/gif"], addRandomSuffix: true,
  maximumSizeInBytes: 5_000_000 }`.
- `onUploadCompleted` — no-op (persistence happens via an explicit server action after the client upload
  resolves, which is reliable in local dev where Blob can't call back to localhost).

### 3. Photo server actions — `src/actions/photos.ts`

All `"use server"`, `requireHousehold()`-scoped, item ownership verified, returning `Result`.
- `setItemPhoto({ itemId, url, pathname })` — verify the item; if it already has a `photoPath` that is a
  Blob pathname, `del()` the old blob (best-effort); update `photoUrl = url`, `photoPath = pathname`;
  `revalidatePath("/items")`.
- `removeItemPhoto(itemId)` — verify the item; `del()` the current blob (best-effort, only if `photoPath`
  is a Blob path); clear `photoUrl`/`photoPath`; revalidate.

(“Is a Blob pathname” = not one of the legacy Supabase paths; simplest test: attempt `del()` only when
`photoUrl` is on the Blob host, and always `.catch(() => {})` so a stale/foreign path never fails the write.)

### 4. UI — `src/components/ItemManager.tsx`

- **Item rows:** render a small `<img>` thumbnail (`h-8 w-8 rounded object-cover`) when `photoUrl` is set,
  else the existing emoji.
- **Edit form:** a photo block — the current photo preview (or a placeholder), a **file input** that runs
  the client upload, and a **Remove** button:
  - On file pick: `upload(file.name, file, { access: "public", handleUploadUrl: "/api/photo/upload",
    clientPayload: JSON.stringify({ itemId }) })` → on success call `setItemPhoto({ itemId, url:
    blob.url, pathname: blob.pathname })` → `router.refresh()`. Show a spinner while uploading; show errors.
  - Photo actions require an **already-created** item (need an `itemId`); on the "new item" form the photo
    block is hidden/disabled until the item is saved (photo is added by editing). Page fetch adds
    `photoUrl: true` to the item `select`; `ItemRow` gains `photoUrl: string | null`.

### 5. Migrate the 6 — `scripts/migrate-photos.ts`

One-off, controller-run (`node --env-file=.env --import tsx scripts/migrate-photos.ts`): for each item
whose `photoUrl` is set but **not** on the Blob host, `fetch()` the current (Supabase) URL → `put(pathname,
arrayBuffer, { access: "public", token: BLOB_READ_WRITE_TOKEN, contentType })` → update `photoUrl`/
`photoPath` to the Blob values. Idempotent (skips items already on the Blob host). Read-only on Supabase
(just fetches the public image URLs).

## Authorization / integrity rules

- The upload token is minted only for a logged-in user's **own household item** (ownership checked in
  `onBeforeGenerateToken`); content-type + size are constrained there too.
- `setItemPhoto`/`removeItemPhoto` verify item ownership under `requireHousehold()`; no unscoped writes.
- Blob deletes are best-effort (`.catch`) so a missing/foreign blob never fails the DB write.

## Testing

- **Unit:** a small pure helper `isBlobUrl(url)` (host check) used to decide whether to `del()` — unit-tested.
- **Live smoke (controller):** upload an image to a seeded item via the app → `photoUrl` on the Blob host,
  thumbnail shows; replace it → old blob gone, new one shown; remove → fields cleared + blob deleted.
  Then run the migration script → the 6 items' `photoUrl` move to the Blob host and the images load.
  (Browser is localhost-sandboxed, so the upload UI is exercised by driving the `/api/photo/upload` +
  `setItemPhoto` path via a scripted client-upload, and the migration verified by DB host checks.)

## Verification

`tsc`/`lint`/`vitest`/`build` clean; a scripted upload round-trip against Blob; the migration moves the 6.
Branch stays `next-migration`.
