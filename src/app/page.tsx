import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";

// The bare domain shouldn't land on a placeholder — send visitors into the
// app. Signed-in users go to their dashboard; everyone else to the login page
// (which is where a new visitor tries the demo account).
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
