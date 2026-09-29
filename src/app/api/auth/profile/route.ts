import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/crypto";
import { jsonError, jsonOk, requireUser, audit, sanitizeText, sanitizeUrl, rateLimit, clearSessionCookie, sessionResponse } from "@/lib/api-utils";
import { sendMail } from "@/lib/mailer";

// PATCH /api/auth/profile — A-06 : nom, prénom, photo, langue, fuseau, préférences
export async function PATCH(req: NextRequest) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.firstName === "string") data.firstName = sanitizeText(body.firstName, 80) || user.firstName;
  if (typeof body.lastName === "string") data.lastName = sanitizeText(body.lastName, 80) || user.lastName;
  if (typeof body.avatarUrl === "string") {
    // http(s) uniquement — bloque javascript:, data:… (XSS)
    const url = sanitizeUrl(body.avatarUrl);
    if (body.avatarUrl.trim() !== "" && !url) {
      return jsonError("VALIDATION_FAILED", "Lien invalide.", 422, { avatarUrl: "Adresse http(s) valide requise." });
    }
    data.avatarUrl = url;
  }
  if (body.locale === "fr" || body.locale === "en") data.locale = body.locale;
  if (typeof body.timezone === "string") data.timezone = body.timezone.slice(0, 64);
  if (typeof body.notifyOnResponse === "boolean") data.notifyOnResponse = body.notifyOnResponse;
  if (typeof body.notifyOnMember === "boolean") data.notifyOnMember = body.notifyOnMember;
  if (typeof body.dailyDigest === "boolean") data.dailyDigest = body.dailyDigest;

  // Changement de mot de passe (A-03/A-04) — ancien requis, brute force limité
  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    const oldPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (body.newPassword.length < 8) {
      return jsonError("VALIDATION_FAILED", "Certains champs nécessitent votre attention.", 422, {
        newPassword: "8 caractères minimum.",
      });
    }
    if (!rateLimit(`pwd-change:${user.id}`, 10, 900_000)) {
      return jsonError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.", 429);
    }
    if (!verifyPassword(oldPassword, user.passwordHash)) {
      return jsonError("VALIDATION_FAILED", "Certains champs nécessitent votre attention.", 422, {
        currentPassword: "Mot de passe actuel incorrect.",
      });
    }
    data.passwordHash = hashPassword(body.newPassword);
    await sendMail({
      to: user.email,
      subject: "Votre mot de passe MEAH COLLECT a été modifié",
      text: `Bonjour,\n\nVotre mot de passe vient d'être modifié depuis vos paramètres. Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
    });
  }

  await db.user.update({ where: { id: user.id }, data });
  await audit(user.id, "user.profile_updated", "user", user.id);
  // Changement de mot de passe : la session courante est re-signée (les autres sessions,
  // signées avec l'ancien hash, sont révoquées automatiquement par la vérification pv).
  if (typeof data.passwordHash === "string") {
    return sessionResponse(user.id, data.passwordHash, { ok: true, sessionsRotated: true });
  }
  return jsonOk({ ok: true });
}

// DELETE /api/auth/profile — A-07 + RGPD (§9.4) : anonymisation immédiate et définitive
export async function DELETE() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  await audit(user.id, "user.delete_requested", "user", user.id, { mode: "anonymisation_immediate" });
  // Anonymisation immédiate des données personnelles + suspension du compte
  // (la ligne est conservée pour l'intégrité des réponses collectées, sans donnée personnelle).
  const anonym = `supprimé-${user.id.slice(0, 12)}@anonyme.local`;
  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        firstName: "Compte",
        lastName: "supprimé",
        email: anonym,
        passwordHash: "deleted",
        avatarUrl: null,
        isSuspended: true,
        verificationCode: null,
        resetToken: null,
        gracePeriodUntil: new Date(),
      },
    });
  } catch {
    // Collision improbable d'email anonymisé → second essai avec un suffixe plus long
    await db.user.update({
      where: { id: user.id },
      data: {
        email: `supprime-${user.id}@anonyme.local`,
        isSuspended: true,
        passwordHash: "deleted",
      },
    });
  }
  // Purge du cookie : le client est déconnecté immédiatement.
  return clearSessionCookie();
}
