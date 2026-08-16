import { prisma } from "@/lib/prisma";
import { getDictionary, t } from "@/i18n";
import { ConsentActions } from "@/components/ConsentActions";

const d = getDictionary("en");

export const dynamic = "force-dynamic";

/**
 * The mcp/oidc plugin's `/mcp/authorize` handler redirects here (this page
 * is configured as `consentPage` in src/lib/auth-server.ts) with
 * `?consent_code=...&client_id=...&scope=...` — confirmed against
 * node_modules/better-auth/dist/plugins/mcp/authorize.mjs (authorizeMCPOAuth,
 * the function actually wired to the advertised authorization_endpoint) and
 * node_modules/better-auth/dist/plugins/oidc-provider/authorize.mjs (same
 * three params). This page lives behind the (app) layout's auth guard, which
 * the plugin's flow already guarantees (it only reaches consentPage once the
 * user has a session — see src/actions/auth.ts `logIn` for the login
 * round-trip that gets a not-yet-authenticated visitor back here).
 */
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; scope?: string; consent_code?: string }>;
}) {
  const { client_id: clientId, scope, consent_code: consentCode } = await searchParams;

  if (!consentCode || !clientId) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-2xl border border-neutral bg-white p-6 text-center">
          <p className="text-sm text-text/70">{t(d, "oauth.consent.invalid")}</p>
        </div>
      </div>
    );
  }

  const client = await prisma.oauthApplication.findUnique({
    where: { clientId },
    select: { name: true, icon: true },
  });
  const clientName = client?.name ?? clientId;
  const scopes = (scope ?? "").split(" ").filter(Boolean);

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-2xl border border-neutral bg-white p-6">
        {client?.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.icon} alt="" className="mb-3 h-10 w-10 rounded-lg" />
        )}
        <h1 className="text-xl font-extrabold">{t(d, "oauth.consent.title")}</h1>
        <p className="mt-2 text-sm text-text/70">{t(d, "oauth.consent.heading", { client: clientName })}</p>
        {scopes.length > 0 && (
          <>
            <p className="mt-4 text-sm font-bold">{t(d, "oauth.consent.scopesHeading")}</p>
            <ul className="mt-2 space-y-1">
              {scopes.map((s) => (
                <li key={s} className="rounded-lg bg-text/5 px-3 py-1.5 text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
        <ConsentActions consentCode={consentCode} />
      </div>
    </div>
  );
}
