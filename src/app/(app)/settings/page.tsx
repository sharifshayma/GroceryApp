import { requireUser } from "@/lib/auth-guard";
import { listMcpTokens } from "@/lib/mcp-token";
import { getDictionary, t } from "@/i18n";
import { McpTokensCard } from "@/components/McpTokensCard";

const d = getDictionary("en");

export default async function SettingsPage() {
  const user = await requireUser();
  const tokens = await listMcpTokens(user.id);
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const endpoint = base + "/api/mcp";
  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-extrabold">{t(d, "settings.title")}</h1>
      <McpTokensCard
        initialTokens={tokens.map((tk) => ({
          id: tk.id,
          name: tk.name,
          lastFour: tk.lastFour,
          createdAt: tk.createdAt.toISOString(),
          lastUsedAt: tk.lastUsedAt ? tk.lastUsedAt.toISOString() : null,
        }))}
        endpoint={endpoint}
      />
    </div>
  );
}
