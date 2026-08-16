"use server";

import { Prisma } from "@prisma/client";
import { APIError } from "better-auth";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { generateInviteCode } from "@/lib/invite-code";
import { seedDefaultCategories } from "@/lib/default-categories";
import {
  signupSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  type SignupInput,
} from "@/lib/validations";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Signs the user in and, if this login is continuing an in-progress OAuth
 * `/authorize` request, resumes it — otherwise sends the user to "/".
 *
 * Login round-trip (confirmed against node_modules/better-auth/dist/plugins/mcp/authorize.mjs
 * and node_modules/better-auth/dist/plugins/mcp/index.mjs):
 * - When an unauthenticated browser hits `/api/auth/mcp/authorize`, the plugin
 *   sets a signed `oidc_login_prompt` cookie (the original authorize query)
 *   and 302s to `loginPage` ("/login") with that same query string appended.
 *   That's a real top-level navigation, so the cookie is already in the
 *   browser by the time /login renders — no return/callback param needs to
 *   be threaded through the URL or the login form.
 * - The plugin also registers an `after` hook (matcher: all requests) that
 *   fires whenever a request both carries that cookie AND just set a new
 *   session cookie. It resumes the authorize flow inline and throws
 *   `ctx.redirect(...)` — an APIError with status "FOUND" and a `location`
 *   header — in place of the normal sign-in response, pointing either at our
 *   own consent page or straight at the OAuth client's (often cross-origin)
 *   redirect_uri.
 * - The previous /login page called the client-side `signIn.email()`, a
 *   fetch() that would auto-follow that redirect: for a same-origin target
 *   the tab never actually navigates (fetch consumes the redirect
 *   internally); for a cross-origin target the browser still fires the
 *   request (silently burning the one-time code) but fetch's default "cors"
 *   mode has no way to succeed against a foreign origin, so the promise
 *   rejects and nothing happens. Calling `auth.api.signInEmail` here instead
 *   and finishing with next/navigation's `redirect()` performs a real
 *   top-level navigation for both cases.
 * - `nextCookies()` (in src/lib/auth-server.ts) normally persists Set-Cookie
 *   headers via its own `after` hook, but it's uncertain whether that still
 *   runs once an earlier hook (the mcp plugin's) has thrown — so the session
 *   cookie, which travels on the SAME headers object as the thrown redirect,
 *   is forwarded manually here as a defensive measure regardless of hook
 *   ordering.
 */
export async function logIn(email: string, password: string): Promise<Result> {
  let resumeTo: string | null = null;
  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (e) {
    if (!(e instanceof APIError)) throw e;
    // APIError.headers is typed as HeadersInit, but better-call always
    // constructs it as a real `Headers` instance (node_modules/better-call/dist/context.mjs).
    const errorHeaders = new Headers(e.headers);
    const location = errorHeaders.get("location");
    if (!location) return { ok: false, error: "Invalid email or password" };

    const store = await cookies();
    for (const raw of errorHeaders.getSetCookie()) {
      const parsed = parseSetCookieHeader(raw);
      parsed.forEach((value, key) => {
        if (!key) return;
        try {
          store.set(key, value.value, toCookieOptions(value));
        } catch {
          // Outside a request that can mutate cookies (shouldn't happen for
          // a Server Action); matches next-cookies' own best-effort handling.
        }
      });
    }
    resumeTo = location;
  }
  redirect(resumeTo ?? "/");
}

export async function signUp(input: SignupInput): Promise<Result> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid signup details" };
  const { email, password, displayName } = parsed.data;
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name: displayName } });
    await prisma.user.update({ where: { id: res.user.id }, data: { displayName } });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? (e as { body?: { message?: string } }).body?.message ?? e.message : "";
    if (msg.includes("USER_ALREADY_EXISTS")) return { ok: false, error: "That email is already registered" };
    return { ok: false, error: "Could not create the account" };
  }
}

export async function createHousehold(name: string): Promise<Result> {
  const parsed = createHouseholdSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: "Please enter a household name" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { householdId: true } });
  if (existing?.householdId) return { ok: false, error: "You're already in a household" };

  // Retry only on the (rare) inviteCode unique collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const hh = await tx.household.create({
          data: { name: parsed.data.name, inviteCode: generateInviteCode(), createdById: user.id },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { householdId: hh.id, role: "owner" },
        });
        await seedDefaultCategories(tx, hh.id);
      });
      return { ok: true };
    } catch (e) {
      const isInviteCodeCollision =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isInviteCodeCollision) return { ok: false, error: "Could not create the household" };
      if (attempt === 4) return { ok: false, error: "Could not create the household" };
    }
  }
  return { ok: false, error: "Could not create the household" };
}

export async function joinHousehold(code: string): Promise<Result> {
  const parsed = joinHouseholdSchema.safeParse({ code });
  if (!parsed.success) return { ok: false, error: "Enter a valid 8-character code" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { householdId: true } });
  if (existing?.householdId) return { ok: false, error: "You're already in a household" };

  const hh = await prisma.household.findUnique({ where: { inviteCode: parsed.data.code } });
  if (!hh) return { ok: false, error: "No household found for that code" };
  await prisma.user.update({
    where: { id: user.id },
    data: { householdId: hh.id, role: "member" },
  });
  return { ok: true };
}
