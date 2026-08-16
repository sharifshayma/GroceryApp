# M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the original app's theme, wire up bilingual EN/HE + RTL, and stand up the bottom-tab-bar shell — the foundation every restored screen (M2–M5) builds on.

**Architecture:** UI-only, on branch `feat/ui-restoration` off `main`. Reuse the existing Prisma schema, server actions, and read queries unchanged. Replace the theme tokens with the original palette + Nunito, activate the existing-but-unused i18n machinery (`LocaleProvider`/`useT()`), and replace the top-nav `(app)` layout with a centered `max-w-lg` column + bottom `TabBar`. Home and Profile are **stubs** in M1 (filled in M2/M5); Lists and Stock tabs point at the existing plain pages for now.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19, Tailwind v4 (`@theme`/`@utility` in CSS), `next/font/google` (Nunito), Prisma 6, Vitest 4, TypeScript.

## Global Constraints

- **Branch:** all work on `feat/ui-restoration`. Do **not** merge to `main` in M1 (cutover happens after M1–M4). Personal git identity (`sharifshayma` / `sharif.shayma@gmail.com`).
- **No schema/backend changes.** No migrations. No edits to auth/MCP config or mutation cores.
- **Reference:** the original app is `cb425ac:src-vite-legacy/` — match it. Original design tokens are in `cb425ac:src-vite-legacy/index.css`.
- **Keep legacy tokens temporarily.** The old tokens (`brand`/`ink`/`paper`/`border`/`card`/`muted`/`accent`/`gold`) stay defined alongside the new ones so not-yet-rebuilt `(app)` screens (items/lists/stock/settings/prices/categories/tags) keep rendering during M2–M4. They are removed in the M5 cutover cleanup, **not** here.
- **Locale default is English** (`User.language` default `en`); RTL only when the user is Hebrew.
- **Logical properties for RTL:** use `ps-`/`pe-`/`ms-`/`me-`/`start`/`end`, never `pl-`/`pr-`/`left`/`right`, in anything built here.
- Each task ends `tsc`+`lint`+`build` clean (and `vitest` where tests exist).

---

## File Structure

**Create:**
- `src/lib/i18n-names.ts` — `getItemName`/`getCategoryName` bilingual display helpers (pure).
- `src/lib/i18n-names.test.ts` — unit tests for the helpers.
- `src/actions/preferences.ts` — `setLanguage` server action.
- `src/hooks/useKeyboardVisible.ts` — visualViewport keyboard detection (ported).
- `src/components/Icons.tsx` — tab-bar icon set (ported; more icons added by later milestones).
- `src/components/TabBar.tsx` — bottom tab bar.
- `src/components/LanguageToggle.tsx` — EN/HE toggle.
- `src/app/(app)/page.tsx` — Home **stub** (route `/`).
- `src/app/(app)/profile/page.tsx` — Profile **stub** (route `/profile`).

**Modify:**
- `src/app/globals.css` — add original palette tokens, animations, mobile CSS (keep legacy tokens).
- `src/app/layout.tsx` — add Nunito font, expose `--font-sans`.
- `src/lib/auth-guard.ts` — add `language` to `CurrentUser`.
- `src/i18n/LocaleProvider.tsx` — add a direction-sync effect (sets `document.documentElement.dir/lang`).
- `src/app/(app)/layout.tsx` — replace top-nav with the centered column + `LocaleProvider` + `TabBar` + low-stock badge.
- `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx` — restyle to new tokens.
- `src/actions/auth.ts` — post-login redirect `/items` → `/`.
- `src/app/onboarding/page.tsx` — guard redirect `/items` → `/`; `src/components/OnboardingForm.tsx` — `router.push("/items")` → `"/"`.

**Delete:**
- `src/app/page.tsx` (the root redirect — Home now owns `/` inside `(app)`).
- `src/app/(app)/dashboard/page.tsx` (retired tiles).

---

### Task 1: Branch + theme foundation (tokens, animations, Nunito)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties `--color-primary|primary-dark|primary-light|secondary|secondary-light|green|green-dark|green-light|neutral|bg|surface|danger|text|text-secondary`, Tailwind color utilities for each (`bg-primary`, `text-text-secondary`, `border-neutral`, `bg-bg`, `bg-danger`, …), utilities `animate-fade-in`/`animate-slide-up`/`animate-backdrop`, and `--font-sans` bound to Nunito.

- [ ] **Step 1: Create the branch**

```bash
cd "$(git rev-parse --show-toplevel)"
git checkout main && git pull --ff-only
git checkout -b feat/ui-restoration
```

- [ ] **Step 2: Rewrite `globals.css`** — keep the legacy `:root`/`@theme inline` block, and ADD the original design system. Final file:

```css
@import "tailwindcss";

/* ===== Original design system (restored) ===== */
@theme {
  --color-primary: #F28B30;
  --color-primary-dark: #E8611A;
  --color-primary-light: #F2A665;
  --color-secondary: #E8C840;
  --color-secondary-light: #F2E085;
  --color-green: #8BC34A;
  --color-green-dark: #5A9E3E;
  --color-green-light: #C5E1A5;
  --color-neutral: #D4C48A;
  --color-bg: #FFF8E7;
  --color-surface: #FFFFFF;
  --color-danger: #E8611A;
  --color-text: #3D2E1E;
  --color-text-secondary: #8A7A6A;
  --font-sans: var(--font-nunito), "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-up { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
@keyframes backdrop-fade { from { opacity: 0; } to { opacity: 1; } }
@utility animate-fade-in { animation: fade-in 0.2s ease-out; }
@utility animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
@utility animate-backdrop { animation: backdrop-fade 0.2s ease-out; }

/* ===== Legacy tokens — DEPRECATED, removed at M5 cutover. Kept so
   not-yet-rebuilt (app) screens still render during M2–M4. ===== */
:root {
  --paper: #fdf8f0;
  --ink: #241a14;
  --brand: #b5542c;
  --brand-dark: color-mix(in srgb, var(--brand) 82%, #000);
  --accent: #1f6f6b;
  --gold: #d9a441;
  --card: #ffffff;
  --muted: #7a6a5c;
  --border: #e7dbc9;
}
@theme inline {
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-brand: var(--brand);
  --color-brand-dark: var(--brand-dark);
  --color-accent: var(--accent);
  --color-gold: var(--gold);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-border: var(--border);
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-tap-highlight-color: transparent;
  margin: 0;
}

/* Prevent iOS Safari auto-zoom on input focus (fires below 16px) */
input, textarea, select { font-size: 16px; }

.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
```

- [ ] **Step 3: Add Nunito in the root layout** — replace `src/app/layout.tsx` with:

```tsx
import "./globals.css";
import Script from "next/script";
import { Nunito } from "next/font/google";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = { title: "GroceryApp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        {children}
        <Script
          src="https://umami-iota-six-97.vercel.app/script.js"
          data-website-id="d5b8429d-dc94-449c-b434-9934a2139ad8"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles clean. (Nunito fetched at build; tokens available.)

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): restore original theme tokens, animations, and Nunito font"
```

---

### Task 2: Bilingual name helpers (`i18n-names.ts`) — TDD

**Files:**
- Create: `src/lib/i18n-names.ts`
- Test: `src/lib/i18n-names.test.ts`

**Interfaces:**
- Produces: `getItemName(item: { name: string; nameHe?: string | null }, locale: Locale): string` and `getCategoryName(cat: { name: string; nameHe?: string | null }, locale: Locale): string`. In Hebrew, return `nameHe` if non-empty, else fall back to `name`. In English, always `name`.

- [ ] **Step 1: Write the failing test** — `src/lib/i18n-names.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getItemName, getCategoryName } from "./i18n-names";

describe("getItemName", () => {
  it("returns English name in en", () => {
    expect(getItemName({ name: "Milk", nameHe: "חלב" }, "en")).toBe("Milk");
  });
  it("returns Hebrew name in he", () => {
    expect(getItemName({ name: "Milk", nameHe: "חלב" }, "he")).toBe("חלב");
  });
  it("falls back to name in he when nameHe missing/empty", () => {
    expect(getItemName({ name: "Milk", nameHe: null }, "he")).toBe("Milk");
    expect(getItemName({ name: "Milk", nameHe: "" }, "he")).toBe("Milk");
    expect(getItemName({ name: "Milk" }, "he")).toBe("Milk");
  });
});

describe("getCategoryName", () => {
  it("mirrors getItemName behavior", () => {
    expect(getCategoryName({ name: "Dairy", nameHe: "מוצרי חלב" }, "he")).toBe("מוצרי חלב");
    expect(getCategoryName({ name: "Dairy", nameHe: null }, "he")).toBe("Dairy");
    expect(getCategoryName({ name: "Dairy", nameHe: "x" }, "en")).toBe("Dairy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/i18n-names.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/i18n-names.ts`:

```ts
import type { Locale } from "@/i18n";

type Named = { name: string; nameHe?: string | null };

export function getItemName(item: Named, locale: Locale): string {
  if (locale === "he") return item.nameHe?.trim() ? item.nameHe : item.name;
  return item.name;
}

export function getCategoryName(cat: Named, locale: Locale): string {
  return getItemName(cat, locale);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/i18n-names.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n-names.ts src/lib/i18n-names.test.ts
git commit -m "feat(i18n): bilingual item/category name helpers"
```

---

### Task 3: `setLanguage` action + expose `language` on the current user

**Files:**
- Create: `src/actions/preferences.ts`
- Modify: `src/lib/auth-guard.ts`

**Interfaces:**
- Consumes: `Locale` from `@/i18n`, `requireUser` from `@/lib/auth-guard`, `prisma` from `@/lib/prisma`.
- Produces: `setLanguage(locale: Locale): Promise<void>` (updates the caller's `User.language`, revalidates), and `CurrentUser.language: Locale`.

- [ ] **Step 1: Extend `CurrentUser`** — in `src/lib/auth-guard.ts`, add `language` (fetched via Prisma since the session doesn't carry it). Replace the file body's type + getter:

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n";

export type CurrentUser = { id: string; email: string; name: string; language: Locale };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const { id, email, name } = session.user;
  const row = await prisma.user.findUnique({ where: { id }, select: { language: true } });
  return { id, email, name, language: (row?.language ?? "en") as Locale };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
```

- [ ] **Step 2: Create `setLanguage`** — `src/actions/preferences.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import type { Locale } from "@/i18n";

export async function setLanguage(locale: Locale): Promise<void> {
  if (locale !== "en" && locale !== "he") return;
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { language: locale } });
  revalidatePath("/", "layout");
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/actions/preferences.ts src/lib/auth-guard.ts
git commit -m "feat(i18n): setLanguage action + expose user.language on the session guard"
```

---

### Task 4: Direction sync in `LocaleProvider`

**Files:**
- Modify: `src/i18n/LocaleProvider.tsx`

**Interfaces:**
- Consumes: `locale` prop (already there).
- Produces: as a side effect, sets `document.documentElement.dir` (`dirFor(locale)`) and `lang` on the client whenever locale changes. Ports `cb425ac:src-vite-legacy/hooks/useDirection.js`.

- [ ] **Step 1: Add the effect** — insert into `LocaleProvider` (keep the existing context value):

```tsx
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
```

Add inside `LocaleProvider`, before the `return`:

```tsx
useEffect(() => {
  document.documentElement.dir = dirFor(locale);
  document.documentElement.lang = locale;
}, [locale]);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/LocaleProvider.tsx
git commit -m "feat(i18n): sync <html dir/lang> from locale in LocaleProvider"
```

---

### Task 5: Tab-bar icons (`Icons.tsx`)

**Files:**
- Create: `src/components/Icons.tsx`

**Interfaces:**
- Produces: `IconHome`, `IconHomeFilled`, `IconLists`, `IconListsFilled`, `IconStock`, `IconStockFilled`, `IconProfile`, `IconProfileFilled` — each `({ className }: { className?: string }) => JSX`. (Later milestones append search/settings/chevron/illustration icons to this file.)

- [ ] **Step 1: Create `src/components/Icons.tsx`** (ported from `cb425ac:src-vite-legacy/components/Icons.jsx`, typed):

```tsx
type IconProps = { className?: string };

export function IconHomeFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.707 2.293a1 1 0 00-1.414 0l-8 8A1 1 0 004 12h1v7a2 2 0 002 2h3a1 1 0 001-1v-4a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 001 1h3a2 2 0 002-2v-7h1a1 1 0 00.707-1.707l-8-8z" />
    </svg>
  );
}

export function IconHome({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  );
}

export function IconListsFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="7.5" cy="8.5" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="7.5" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
      <circle cx="7.5" cy="12" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="11" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
      <circle cx="7.5" cy="15.5" r="1" fill="var(--color-bg, #FFF8E7)" />
      <rect x="10.5" y="14.5" width="7" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
    </svg>
  );
}

export function IconLists({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="8.5" x2="7.5" y2="8.5" strokeWidth={2} />
      <line x1="11" y1="8.5" x2="17" y2="8.5" />
      <line x1="7.5" y1="12" x2="7.5" y2="12" strokeWidth={2} />
      <line x1="11" y1="12" x2="17" y2="12" />
      <line x1="7.5" y1="15.5" x2="7.5" y2="15.5" strokeWidth={2} />
      <line x1="11" y1="15.5" x2="17" y2="15.5" />
    </svg>
  );
}

export function IconStockFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v1a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
      <path d="M5 10h14v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9z" />
      <rect x="9" y="12" width="6" height="2" rx="1" fill="var(--color-bg, #FFF8E7)" />
    </svg>
  );
}

export function IconStock({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M5 10v9a2 2 0 002 2h10a2 2 0 002-2v-9" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function IconProfileFilled({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="9" r="3.5" />
      <path d="M12 14c-4.418 0-7 2.239-7 4.5 0 .828.559 1.5 1.25 1.5h11.5c.691 0 1.25-.672 1.25-1.5 0-2.261-2.582-4.5-7-4.5z" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function IconProfile({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="3" />
      <path d="M6.168 18.849A4 4 0 0110 16h4a4 4 0 013.834 2.855" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/Icons.tsx
git commit -m "feat(ui): port tab-bar icon set"
```

---

### Task 6: `useKeyboardVisible` hook + `TabBar`

**Files:**
- Create: `src/hooks/useKeyboardVisible.ts`
- Create: `src/components/TabBar.tsx`

**Interfaces:**
- Consumes: the 8 tab icons (Task 5), `useT` from `@/i18n/LocaleProvider`, `usePathname`/`Link` from Next.
- Produces: `useKeyboardVisible(): { isKeyboardVisible: boolean }`; `TabBar({ lowStockCount }: { lowStockCount: number })` — fixed bottom nav, 4 tabs, active-state icons, low-stock badge on Stock, hidden when the keyboard is visible. Reads its label strings from `d.nav.{home,lists,stock,profile}` (added in Task 9's dictionary edit — until then use literal fallbacks via `t`).

- [ ] **Step 1: Create `src/hooks/useKeyboardVisible.ts`** (ported, SSR-guarded):

```ts
"use client";

import { useState, useEffect } from "react";

export function useKeyboardVisible(): { isKeyboardVisible: boolean } {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      setIsKeyboardVisible(viewport.height < window.innerHeight * 0.75);
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  return { isKeyboardVisible };
}
```

- [ ] **Step 2: Add nav strings to both dictionaries** — in `src/i18n/dictionaries/en.ts` add a top-level `nav` key: `nav: { home: "Items", lists: "Lists", stock: "Stock", profile: "Profile" },` and in `src/i18n/dictionaries/he.ts`: `nav: { home: "פריטים", lists: "רשימות", stock: "מלאי", profile: "פרופיל" },`. (The original Home titles its screen "Items"/"פריטים"; the Home tab label matches.)

- [ ] **Step 3: Create `src/components/TabBar.tsx`** (ports `cb425ac:.../components/TabBar.jsx`):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import {
  IconHome, IconHomeFilled, IconLists, IconListsFilled,
  IconStock, IconStockFilled, IconProfile, IconProfileFilled,
} from "@/components/Icons";

type Tab = { path: string; key: "home" | "lists" | "stock" | "profile"; icon: (a: boolean) => React.ReactNode };

const tabs: Tab[] = [
  { path: "/", key: "home", icon: (a) => (a ? <IconHomeFilled /> : <IconHome />) },
  { path: "/lists", key: "lists", icon: (a) => (a ? <IconListsFilled /> : <IconLists />) },
  { path: "/stock", key: "stock", icon: (a) => (a ? <IconStockFilled /> : <IconStock />) },
  { path: "/profile", key: "profile", icon: (a) => (a ? <IconProfileFilled /> : <IconProfile />) },
];

export function TabBar({ lowStockCount }: { lowStockCount: number }) {
  const pathname = usePathname();
  const { t } = useT();
  const { isKeyboardVisible } = useKeyboardVisible();
  if (isKeyboardVisible) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-surface border-t border-neutral z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/"
              ? pathname === "/" || pathname.startsWith("/category")
              : pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 transition-colors ${
                isActive ? "text-primary" : "text-text-secondary"
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {tab.key === "stock" && lowStockCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-medium flex items-center justify-center">
                    {lowStockCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{t(`nav.${tab.key}`)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean. (TabBar isn't mounted yet — Task 9.)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardVisible.ts src/components/TabBar.tsx src/i18n/dictionaries/en.ts src/i18n/dictionaries/he.ts
git commit -m "feat(ui): bottom TabBar + keyboard-visibility hook + nav strings"
```

---

### Task 7: `LanguageToggle` component

**Files:**
- Create: `src/components/LanguageToggle.tsx`

**Interfaces:**
- Consumes: `useT`, `setLanguage` (Task 3).
- Produces: `LanguageToggle({ compact }: { compact?: boolean })` — EN / עברית segmented control; clicking calls `setLanguage` then `router.refresh()`. Ports `cb425ac:.../components/LanguageToggle.jsx`.

- [ ] **Step 1: Create `src/components/LanguageToggle.tsx`:**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/LocaleProvider";
import { setLanguage } from "@/actions/preferences";
import type { Locale } from "@/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (lang: Locale) => {
    if (lang === locale || pending) return;
    startTransition(async () => {
      await setLanguage(lang);
      router.refresh();
    });
  };

  const btn = (lang: Locale, label: string) =>
    `${compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"} rounded-lg font-semibold transition-colors ${
      locale === lang ? "bg-primary text-white" : "text-text-secondary hover:text-text"
    }`;

  return (
    <div className={`flex items-center gap-1 rounded-xl border border-neutral bg-surface p-1 ${compact ? "p-0.5" : ""}`}>
      <button type="button" onClick={() => switchTo("en")} className={btn("en", "EN")}>
        {compact ? "EN" : "English"}
      </button>
      <button type="button" onClick={() => switchTo("he")} className={btn("he", "עב")}>
        {compact ? "עב" : "עברית"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/LanguageToggle.tsx
git commit -m "feat(i18n): LanguageToggle control"
```

---

### Task 8: Restyle shared `Button` + `Input` to the new tokens

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`

**Interfaces:**
- Produces: same component APIs, restyled to the original palette (used by the auth pages and every restored screen).

- [ ] **Step 1: Restyle `Button`** — replace the `variants` map:

```ts
const variants = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-green text-white hover:bg-green-dark",
  ghost: "bg-surface text-text hover:bg-bg border border-neutral",
  danger: "bg-danger text-white hover:opacity-90",
};
```

- [ ] **Step 2: Restyle `Input`/`Textarea`** — in both, swap the label class `text-ink` → `text-text`, and the field classes `border-border … text-ink focus:border-brand focus:ring-brand/20` → `border-neutral bg-surface … text-text focus:border-primary focus:ring-primary/20`. Keep the `error` red states as-is.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Input.tsx
git commit -m "feat(ui): restyle Button/Input to the restored palette"
```

---

### Task 9: App shell — rebuild `(app)/layout.tsx`

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (now with `language`), `getCurrentHousehold`, `getNeedToBuy` (`{ lowCount }`), `LocaleProvider`, `TabBar`.
- Produces: the centered `max-w-lg` column shell wrapping all `(app)` routes with the locale provider (which sets `<html dir>`), the bottom tab bar, and bottom padding so content clears the bar.

- [ ] **Step 1: Replace `src/app/(app)/layout.tsx`:**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getCurrentHousehold } from "@/lib/household-context";
import { getNeedToBuy } from "@/lib/mcp-queries";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { TabBar } from "@/components/TabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const household = await getCurrentHousehold();
  if (!household) redirect("/onboarding");

  const { lowCount } = await getNeedToBuy(household.id);

  return (
    <LocaleProvider locale={user.language}>
      <div className="min-h-screen bg-bg">
        <main className="max-w-lg mx-auto pb-20">{children}</main>
        <TabBar lowStockCount={lowCount} />
      </div>
    </LocaleProvider>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean. (`getCurrentHousehold` returns the full Prisma `Household` model, so `household.id`/`household.name` are valid — confirmed in `src/lib/household-context.ts`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/layout.tsx"
git commit -m "feat(ui): app shell — centered column + LocaleProvider + bottom TabBar"
```

---

### Task 10: Routing — Home/Profile stubs, retire dashboard + root redirect, land on `/`

**Files:**
- Create: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/profile/page.tsx`
- Delete: `src/app/page.tsx`
- Delete: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/actions/auth.ts`, `src/app/onboarding/page.tsx`, `src/components/OnboardingForm.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `useT`/dictionaries.
- Produces: route `/` = Home stub (inside the `(app)` shell + guard), `/profile` = Profile stub; `/dashboard` and the old root redirect gone; post-login/onboarding land on `/`.

- [ ] **Step 1: Home stub** — `src/app/(app)/page.tsx` (a server component; real Home lands in M2):

```tsx
export default function HomePage() {
  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-2xl font-semibold">Items</h1>
      <p className="mt-4 text-text-secondary">Home screen coming in M2.</p>
    </div>
  );
}
```

- [ ] **Step 2: Profile stub** — `src/app/(app)/profile/page.tsx`:

```tsx
import { LanguageToggle } from "@/components/LanguageToggle";

export default function ProfilePage() {
  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="mt-4"><LanguageToggle /></div>
      <p className="mt-4 text-text-secondary">Profile screen coming in M5.</p>
    </div>
  );
}
```

(The toggle here doubles as the M1 language smoke test.)

- [ ] **Step 3: Delete the retired routes**

```bash
git rm src/app/page.tsx "src/app/(app)/dashboard/page.tsx"
```

- [ ] **Step 4: Land on `/`** — in `src/actions/auth.ts` change `redirect(resumeTo ?? "/items")` → `redirect(resumeTo ?? "/")`; in `src/app/onboarding/page.tsx` change `if (household) redirect("/items")` → `redirect("/")`; in `src/components/OnboardingForm.tsx` change both `router.push("/items")` → `router.push("/")`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean; route list shows `/` and `/profile`, no `/dashboard`.

- [ ] **Step 6: Live smoke (dev server, demo household)**

```bash
PORT=3011 npm run dev
```
Verify manually (or via the browser tool) at `http://localhost:3011`:
- Signing in as `demo@grocery.app` / `DemoGrocery2026` lands on `/` inside the shell; the **bottom tab bar** shows Items / Lists / Stock / Profile in Nunito on cream.
- Tapping tabs navigates; **Stock** shows a red low-stock badge (demo has 2 low).
- On **Profile**, clicking **עברית** flips the document to RTL and the tab labels to Hebrew; **English** flips back. Reloading preserves the choice (persisted to `User.language`).
- `/dashboard` now 404s.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/page.tsx" "src/app/(app)/profile/page.tsx" src/actions/auth.ts src/app/onboarding/page.tsx src/components/OnboardingForm.tsx
git commit -m "feat(ui): Home/Profile stubs, retire dashboard + root redirect, land on /"
```

---

## Self-Review

**Spec coverage (M1 rows of the spec's milestone table):** theme tokens + Nunito + animations (Task 1) ✓; i18n/RTL wiring — LocaleProvider dir sync (Task 4), `useT` available, helpers (Task 2), `setLanguage` (Task 3) ✓; app shell — layout + TabBar + Icons + keyboard hook (Tasks 5,6,9) ✓; retire `/dashboard` (Task 10) ✓; restyle auth pages — via Button/Input restyle (Task 8), which the login/signup/reset pages consume ✓; LanguageToggle (Task 7) ✓.

**Deferred to later milestones (intentional):** swapping the ~23 hardcoded `getDictionary("en")` calls in the not-yet-rebuilt screens (they're replaced wholesale in M2–M5); removing legacy theme tokens (M5 cutover); search/settings/chevron/illustration icons (added when M2 needs them).

**Type consistency:** `CurrentUser.language: Locale` (Task 3) feeds `LocaleProvider locale` (Task 9); `getNeedToBuy` returns `{ lowCount }` (verified in `src/lib/mcp-queries.ts`) → `TabBar lowStockCount` (Task 6/9); `useT()` returns `{ t, d, locale, dir }` (existing) used by TabBar/LanguageToggle.

**Resolved:** `household.id`/`household.name` valid — `getCurrentHousehold` returns the full Prisma `Household` model. `getNeedToBuy` returns `{ entries, lowCount, onListCount }`. No open placeholders remain.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-ui-restoration-m1-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
