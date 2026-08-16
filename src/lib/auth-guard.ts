import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth-server";

export type CurrentUser = { id: string; email: string; name: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
