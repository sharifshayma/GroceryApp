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
      <h2 className="text-lg font-bold">{t(d, "settings.connect.heading")}</h2>
      <p className="mt-1 text-sm text-text/70">{t(d, "settings.connect.intro")}</p>

      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-text/80">
        <p>
          <span className="font-semibold">Using claude.ai or the Claude mobile app?</span> You
          don&rsquo;t need a token — add <code className="break-all">{endpoint}</code> as a custom
          connector and sign in. Claude connects over OAuth.
        </p>
        <p className="mt-1.5">
          <span className="font-semibold">Using Claude Desktop?</span> Generate a token below and
          paste it into your <code>mcpServers</code> config (shown at the bottom).
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
    </section>
  );
}
