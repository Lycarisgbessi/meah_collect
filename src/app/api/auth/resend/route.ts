import { db } from "@/lib/db";
import { genCode6 } from "@/lib/crypto";
import { jsonError, jsonOk, requireUser, rateLimit } from "@/lib/api-utils";
import { sendMail } from "@/lib/mailer";

// POST /api/auth/resend — renvoi du code de vérification (délai 60 s côté UI)
export async function POST() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  if (!rateLimit(`resend:${user.id}`, 3, 600_000)) {
    return jsonError("RATE_LIMITED", "Trop de demandes. Réessayez dans quelques minutes.", 429);
  }
  if (user.emailVerified) return jsonOk({ ok: true, alreadyVerified: true });

  const code = genCode6();
  await db.user.update({
    where: { id: user.id },
    data: { verificationCode: code, verificationExpiry: new Date(Date.now() + 24 * 3600_000) },
  });
  await sendMail({
    to: user.email,
    subject: "Votre code de vérification MEAH COLLECT",
    text: `Bonjour,\n\nVotre nouveau code de vérification est : ${code}\nIl expire dans 24 heures.`,
  });
  return jsonOk({ ok: true });
}
