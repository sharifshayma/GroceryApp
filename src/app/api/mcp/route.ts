import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "ping",
      "Health check — returns pong.",
      { echo: z.string().optional() },
      async ({ echo }) => ({
        content: [{ type: "text", text: echo ? `pong: ${echo}` : "pong" }],
      }),
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

export { handler as GET, handler as POST };
