import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, burnPasswordTiming } from "@/lib/crypto";
import { jsonError, sessionResponse, rateLimit, rateLimitPeek, rateLimitRecord, getClientIp, audit } from "@/lib/api-utils";

// POST /api/auth/login — A-03 · 5 ÉCHECS / 15 min / e-mail puis verrouillage progressif (Annexe D.4)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : undefined;

  if (!rateLimitPeek(`login-fail:${email}`, 5, 900_000) || !rateLimitPeek(`login-ip:${ip}`, 30, 900_000)) {
    return jsonError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.", 429);
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    // Égalise le temps de réponse (scrypt) même sans compte → pas d'énumération par timing.
    if (!user) burnPasswordTiming(password);
    // Seuls les échecs consomment le quota (D.4)
    rateLimitRecord(`login-fail:${email}`);
    rateLimitRecord(`login-ip:${ip}`);
    return jsonError("INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect.", 401);
  }
  if (user.isSuspended) {
    return jsonError("ACCOUNT_SUSPENDED", "Ce compte est suspendu. Contactez le support.", 403);
  }

  await audit(user.id, "user.login", "user", user.id);

  // Rattachement à une équipe si l'utilisateur était invité avant connexion (cas limite 5.4)
  let joined: { slug: string; formTitle: string; formId: string } | null = null;
  if (inviteToken) {
    const { joinTeamByToken } = await import("@/lib/team");
    const result = await joinTeamByToken(user.id, inviteToken);
    if (result.ok) joined = { slug: result.slug, formTitle: result.formTitle, formId: result.formId };
  }

  return sessionResponse(user.id, user.passwordHash, {
    ok: true,
    needsVerification: !user.emailVerified,
    joined,
  });
}
