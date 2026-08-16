# Deployment Runbook

Production for this app (Next.js + Prisma Postgres) runs on **Vercel**.

- **Vercel project:** `groceryapp-v2`
- **Production domain:** `grocery.thatsmy.app`
- **Database:** Prisma Postgres (`db.prisma.io`) — already migrated + seeded
- **Blob store:** a **public** Vercel Blob store (item photos)

## Deploying

Two ways, both fine:

- **Git (normal path):** push to `main` → Vercel auto-builds + deploys production, and
  `grocery.thatsmy.app` follows the latest production deployment.
- **CLI (manual):** `vercel deploy --prod` from the repo root.

The build command is `prisma generate && next build` (in `package.json`). The DB is already
migrated, so no migrate step runs at deploy time. If you ever add a Prisma migration, apply it with
`npx prisma migrate deploy` against the production `DATABASE_URL` before/after deploying.

## Required production environment variables

Set these in **Vercel → `groceryapp-v2` → Settings → Environment Variables** (Production; the first
few also in Preview if you want working preview deployments):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | The **direct** Postgres URL: `postgres://…@db.prisma.io:5432/postgres?…`. **Not** the `prisma+postgres://…` Accelerate URL — that has no port and fails with *"invalid port number in database URL"*. |
| `BETTER_AUTH_SECRET` | Strong random string (signs sessions). |
| `BETTER_AUTH_URL` | `https://grocery.thatsmy.app` (Production). Leave **unset in Preview** so better-auth infers the preview origin and sign-in works there. |
| `BLOB_READ_WRITE_TOKEN` | From the connected **public** Blob store. |
| `RESEND_API_KEY` | Password-reset OTP emails (optional; the flow degrades gracefully without it). |

Not needed: `DIRECT_URL` (the Prisma datasource uses only `DATABASE_URL`), `RESEND_FROM_EMAIL`
(defaults to `onboarding@resend.dev`).

## One-time Vercel project settings

These bit us during the initial cutover from the old Vite app — verify them on a fresh project:

1. **Framework preset.** Must resolve to **Next.js**. `vercel.json` in this repo pins
   `{"framework": "nextjs"}` so it doesn't matter what the dashboard preset says. Without it, a
   project still configured for Vite builds Next but serves `dist/` → **404 on every route**.
2. **Deployment Protection.** Turn **Vercel Authentication OFF** (Settings → Deployment Protection) —
   otherwise the whole site sits behind a Vercel-team login and the public app is unreachable. The
   app has its own better-auth login. (On the Hobby plan it's all-or-nothing; "only preview" is Pro.)
3. **Domain.** Add `grocery.thatsmy.app` as a **Production** domain (Settings → Domains).

## Rollback

Production deploys are reversible — the previous deployment stays live in history:

```bash
vercel rollback            # revert to the previous production deployment
# or promote a specific known-good deployment from the Vercel dashboard
```

## Smoke test (after a deploy)

```bash
D=https://grocery.thatsmy.app
curl -s -o /dev/null -w "login  %{http_code}\n" "$D/login"                                  # 200
curl -s -o /dev/null -w "signin %{http_code}\n" -X POST "$D/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'                       # 200 valid / 401 wrong
curl -s -o /dev/null -w "mcp    %{http_code}\n" -X POST "$D/api/mcp" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'                             # 401 without a bearer
```

Reading runtime errors: `vercel logs <deployment-url>` (it tails; trigger the request while it runs).

## MCP

The MCP server is a Next route at `/api/mcp` with hashed **bearer-token** auth. Generate a token on
the live site at **`/settings`** ("Connect to Claude") and use it as the `Authorization: Bearer …`
header in a Claude Desktop/Code MCP config pointing at `https://grocery.thatsmy.app/api/mcp`. (OAuth
custom-connector support is not implemented — bearer only.)
