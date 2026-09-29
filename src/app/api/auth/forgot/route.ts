import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { genToken } from "@/lib/crypto";
import { jsonError, jsonOk, rateLimit, getClientIp, normalizeEmail } from "@/lib/api-utils";
import { sendMail } from "@/lib/mailer";

// POST /api/auth/forgot — A-04 : mot de passe oublié (jeton expirant sous 1 h)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const email = normalizeEmail(body.email);
  if (!rateLimit(`forgot:${email || ip}`, 3, 3600_000)) {
    return jsonError("RATE_LIMITED", "Trop de demandes. Réessayez dans quelques minutes.", 429);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = genToken(24);
    await db.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpiry: new Date(Date.now() + 3600_000) }, // 1 h
    });
    // E2 : le jeton ne quitte JAMAIS le serveur par la réponse HTTP.
    await sendMail({
      to: email,
      subject: "Réinitialisation de votre mot de passe MEAH COLLECT",
      text: `Bonjour,\n\nPour définir un nouveau mot de passe, saisissez ce jeton dans l'application :\n\n${token}\n\nCe jeton expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    });
  }
  // Réponse strictement identique que le compte existe ou non (anti-énumération, Annexe K.3).
  return jsonOk({ ok: true });
}
