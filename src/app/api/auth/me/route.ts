import { jsonOk, getSessionUser } from "@/lib/api-utils";
import type { SessionUser } from "@/lib/types";

// GET /api/auth/me — profil courant
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonOk(null);
  const dto: SessionUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role === "admin" ? "admin" : "user",
    emailVerified: user.emailVerified,
    locale: user.locale,
    timezone: user.timezone,
    notifyOnResponse: user.notifyOnResponse,
    notifyOnMember: user.notifyOnMember,
    dailyDigest: user.dailyDigest,
  };
  return jsonOk(dto);
}
