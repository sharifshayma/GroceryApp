import { Client } from "pg";

export function supabaseConfig() {
  const u = process.env.SUPABASE_DATABASE_URL ?? "";
  const m = u.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/@]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error("SUPABASE_DATABASE_URL missing or unparseable");
  const [, user, password, host, port, database] = m;
  return {
    host,
    port: Number(port),
    user,
    password,
    database: database.split("?")[0],
    ssl: { rejectUnauthorized: false }, // Supabase pooler cert
  };
}

export async function withSource<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(supabaseConfig());
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
