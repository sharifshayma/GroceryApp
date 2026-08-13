import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyMcpToken } from "@/lib/mcp-token";

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "ping",
      "Health check — returns pong.",
      { echo: z.string().optional() },
      async ({ echo }, extra) => {
        const householdId = extra?.authInfo?.extra?.householdId as string | undefined;
        return {
          content: [
            { type: "text", text: `${echo ? `pong: ${echo}` : "pong"} (household ${householdId ?? "?"})` },
          ],
        };
      },
    );
  },
  {
    // server info
    serverInfo: { name: "grocery", version: "1.0.0" },
  },
  {
    // adapter config — stateless HTTP, mounted at /api/mcp
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  },
);

const authedHandler = withMcpAuth(
  baseHandler,
  async (_req: Request, bearer?: string) => {
    if (!bearer) return undefined;
    const v = await verifyMcpToken(bearer);
    if (!v) return undefined;
    return {
      token: bearer,
      scopes: [],
      clientId: v.tokenId,
      extra: { householdId: v.householdId, userId: v.userId },
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST };
