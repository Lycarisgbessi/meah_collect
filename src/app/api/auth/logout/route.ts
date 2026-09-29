import { clearSessionCookie, audit, getSessionUser } from "@/lib/api-utils";

// POST /api/auth/logout — A-08
export async function POST() {
  const user = await getSessionUser();
  if (user) await audit(user.id, "user.logout", "user", user.id);
  return clearSessionCookie();
}
