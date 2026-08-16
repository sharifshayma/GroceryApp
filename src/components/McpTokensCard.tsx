"use client";

import { useState } from "react";
import { getDictionary, t } from "@/i18n";
import { Button } from "@/components/ui/Button";

const d = getDictionary("en");

export function McpTokensCard({ endpoint }: { endpoint: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

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

          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-text/80">
            <li>
              In claude.ai, the Claude mobile app, or Claude Desktop, open{" "}
              <span className="font-medium">Settings&nbsp;→&nbsp;Connectors</span>.
            </li>
            <li>
              Choose <span className="font-medium">Add custom connector</span> and paste the URL
              below.
            </li>
            <li>Sign in when prompted — Claude connects securely over OAuth. No token needed.</li>
          </ol>

          <div className="mt-4">
            <p className="text-xs text-text/60">{t(d, "settings.connect.endpointLabel")}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-text/5 px-2 py-1.5 text-sm">
                {endpoint}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(endpoint);
                  setCopied(true);
                }}
              >
                {copied ? t(d, "settings.connect.copied") : t(d, "settings.connect.copy")}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
