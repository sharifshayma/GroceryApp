"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, t } from "@/i18n";
import { generateMcpToken, revokeMcpTokenAction } from "@/actions/mcp-tokens";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
  const [expanded, setExpanded] = useState(false);

  async function onGenerate() {
    setPending(true);
    setError(null);
    setCopied(false);
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
    setError(null);
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
    <section className="rounded-lg border border-neutral bg-white p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-lg font-bold">{t(d, "settings.connect.heading")}</h2>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-text/50 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {!expanded && (
        <p className="mt-1 text-sm text-text/60">{t(d, "settings.connect.intro")}</p>
      )}

      {expanded && (
        <>
          <p className="mt-3 text-sm text-text/70">{t(d, "settings.connect.intro")}</p>

          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-text/80">
        <p>
          <span className="font-semibold">Easiest — no token needed.</span> In claude.ai, the
          Claude mobile app, or Claude Desktop, add{" "}
          <code className="break-all">{endpoint}</code> as a custom connector
          (Settings&nbsp;→&nbsp;Connectors) and sign in. Claude connects over OAuth.
        </p>
        <p className="mt-1.5">
          <span className="font-semibold">Prefer a manual config?</span> Generate a token below and
          add it to an <code>mcpServers</code> entry with an <code>Authorization: Bearer</code>{" "}
          header (shown at the bottom).
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <Input
            placeholder={t(d, "settings.connect.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button disabled={pending || !name.trim()} onClick={onGenerate}>
          {pending ? t(d, "settings.connect.generating") : t(d, "settings.connect.generate")}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rawToken && (
        <div className="mt-3 rounded border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">{t(d, "settings.connect.oncePrefix")}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 text-sm">{rawToken}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(rawToken);
                setCopied(true);
              }}
            >
              {copied ? t(d, "settings.connect.copied") : t(d, "settings.connect.copy")}
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-4 divide-y divide-neutral">
        {initialTokens.length === 0 && (
          <li className="py-2 text-sm text-text/60">{t(d, "settings.connect.empty")}</li>
        )}
        {initialTokens.map((tk) => (
          <li key={tk.id} className="flex items-start justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-medium">{tk.name ?? "—"}</span>{" "}
              <span className="text-text/50">
                {t(d, "settings.connect.lastFour", { four: tk.lastFour ?? "????" })}
              </span>
              <div className="text-xs text-text/50">
                {t(d, "settings.connect.created")}: {tk.createdAt.slice(0, 10)} ·{" "}
                {t(d, "settings.connect.lastUsed")}:{" "}
                {tk.lastUsedAt ? tk.lastUsedAt.slice(0, 10) : t(d, "settings.connect.never")}
              </div>
            </span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onRevoke(tk.id)}
            >
              {t(d, "settings.connect.revoke")}
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <h3 className="text-sm font-semibold">{t(d, "settings.connect.instructionsHeading")}</h3>
        <p className="mt-1 text-sm text-text/70">{t(d, "settings.connect.instructions")}</p>
        <p className="mt-2 text-xs text-text/60">
          {t(d, "settings.connect.endpointLabel")}: <code>{endpoint}</code>
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-text/5 p-2 text-xs">{configSnippet}</pre>
      </div>
        </>
      )}
    </section>
  );
}
