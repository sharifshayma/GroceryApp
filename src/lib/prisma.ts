import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Prisma Postgres serves runtime traffic over a pooled "Accelerate" connection
// string (starts with `prisma://` / `prisma+postgres://`). That endpoint pools
// connections and lives close to the database — dramatically faster on Vercel
// serverless than the raw `postgres://…:5432` direct connection (which is for
// migrations only). We extend with Accelerate ONLY when DATABASE_URL is such a
// pooled URL; a plain `postgres://` URL keeps the unextended client, so this is
// byte-for-byte the old behavior until the env var is switched over.
function makeClient(): PrismaClient {
  const client = new PrismaClient();
  if ((process.env.DATABASE_URL ?? "").startsWith("prisma")) {
    // Extended client is a structural superset of PrismaClient (adds
    // cacheStrategy); we only use base methods, so this cast is safe.
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
