import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { jsonError, sessionResponse, requireUser, rateLimit, audit } from "@/lib/api-utils";

// POST /api/auth/verify — A-02 : vérification d'e-mail par code à usage unique
export async function POST(req: NextRequest) {
  const { user } = await requireUser().then((r) => ("response" in r ? { user: null } : r));
  if (!user) return jsonError("AUTH_REQUIRED", "Veuillez vous connecter.", 401);

  // Le code à 6 chiffres ne doit pas être énumérable : 10 essais / 15 min / utilisateur.
  if (!rateLimit(`verify:${user.id}`, 10, 900_000)) {
    return jsonError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const code = String(body.code ?? "").trim();
  if (!code) return jsonError("VALIDATION_FAILED", "Saisissez le code reçu.", 422, { code: "Code requis." });

  if (
    !user.verificationCode ||
    !safeEqual(user.verificationCode, code) ||
    !user.verificationExpiry ||
    user.verificationExpiry < new Date()
  ) {
    return jsonError("VALIDATION_FAILED", "Ce code est invalide ou a expiré.", 422, { code: "Code invalide ou expiré." });
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationCode: null, verificationExpiry: null },
  });
  await audit(user.id, "user.email_verified", "user", user.id);
  return sessionResponse(user.id, user.passwordHash, { ok: true, emailVerified: true });
}
