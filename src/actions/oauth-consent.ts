"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";

/**
 * Submits the user's accept/deny decision to the mcp/oidc plugin's consent
 * endpoint (`/oauth2/consent`, body `{ accept, consent_code }` — confirmed
 * against node_modules/better-auth/dist/plugins/oidc-provider/index.mjs).
 *
 * Called via `auth.api.oAuthConsent` (the same handler the plugin exposes at
 * POST /api/auth/oauth2/consent) rather than a client-side fetch: the
 * endpoint always responds with `{ redirectURI }`, and that URI is frequently
 * cross-origin (the OAuth client's own redirect_uri, e.g. claude.ai's
 * callback). A client-side fetch would need to follow that redirect itself,
 * which is subject to CORS for cross-origin targets and would silently
 * consume the one-time authorization code via a background request instead
 * of a real top-level navigation. Calling the endpoint server-side and
 * finishing with next/navigation's `redirect()` performs a genuine browser
 * navigation to the final URI regardless of origin.
 */
export async function submitOAuthConsent(
  accept: boolean,
  consentCode: string,
): Promise<{ error: string } | void> {
  let redirectURI: string;
  try {
    const result = await auth.api.oAuthConsent({
      body: { accept, consent_code: consentCode },
      headers: await headers(),
    });
    redirectURI = result.redirectURI;
  } catch {
    return { error: "oauth.consent.error" };
  }
  redirect(redirectURI);
}
