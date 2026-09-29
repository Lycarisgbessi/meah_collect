import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { jsonError, sessionResponse, audit } from "@/lib/api-utils";
import { sendMail } from "@/lib/mailer";

// POST /api/auth/reset — réinitialisation via jeton (valide 1 h)
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const token = String(body.token ?? "");
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return jsonError("VALIDATION_FAILED", "Certains champs nécessitent votre attention.", 422, {
      password: "8 caractères minimum.",
    });
  }
  const user = await db.user.findFirst({
    where: { resetToken: token, resetExpiry: { gt: new Date() } },
  });
  if (!user) {
    return jsonError("RESET_INVALID", "Ce lien de réinitialisation est invalide ou a expiré.", 410);
  }
  const passwordHash = hashPassword(password);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetExpiry: null },
  });
  await audit(user.id, "user.password_reset", "user", user.id);
  // E3 : alerte « mot de passe modifié » — toutes les anciennes sessions sont invalidées (pv).
  await sendMail({
    to: user.email,
    subject: "Votre mot de passe MEAH COLLECT a été modifié",
    text: `Bonjour,\n\nVotre mot de passe vient d'être modifié. Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
  });
  return sessionResponse(user.id, passwordHash, { ok: true });
}
