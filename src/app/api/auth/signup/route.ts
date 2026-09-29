import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, genCode6 } from "@/lib/crypto";
import { jsonError, sessionResponse, rateLimit, getClientIp, audit, sanitizeText, normalizeEmail } from "@/lib/api-utils";
import { joinTeamByToken } from "@/lib/team";
import { sendMail } from "@/lib/mailer";

// POST /api/auth/signup — A-01, A-05, A-10 (Annexe D : POST /auth/signup)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`signup:${ip}`, 10, 3600_000)) {
    return jsonError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }

  const firstName = sanitizeText(body.firstName, 80);
  const lastName = sanitizeText(body.lastName, 80);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const acceptTerms = body.acceptTerms === true;
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : undefined;

  const fields: Record<string, string> = {};
  if (!firstName) fields.firstName = "Votre prénom est requis.";
  if (!lastName) fields.lastName = "Votre nom est requis.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = "Cette adresse semble incorrecte. Exemple : nom@domaine.com";
  if (password.length < 8) fields.password = "8 caractères minimum.";
  if (!acceptTerms) fields.acceptTerms = "Veuillez accepter les conditions.";
  if (Object.keys(fields).length) {
    return jsonError("VALIDATION_FAILED", "Certains champs nécessitent votre attention.", 422, fields);
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Choix assumé (permet la connexion au lieu d'une nouvelle inscription) :
    // l'existence du compte est indiquée, sans révéler autre chose.
    return jsonError("EMAIL_TAKEN", "Un compte existe déjà avec cette adresse. Connectez-vous.", 409);
  }

  const verificationCode = genCode6();
  const passwordHash = hashPassword(password);
  const user = await db.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
      verificationCode,
      verificationExpiry: new Date(Date.now() + 24 * 3600_000),
      locale: "fr",
    },
  });

  // A-10 : inscription via lien d'invitation → rattachement automatique à l'équipe
  let joined: { slug: string; formTitle: string; formId: string } | null = null;
  let inviteInvalid = false;
  if (inviteToken) {
    const result = await joinTeamByToken(user.id, inviteToken);
    if (result.ok) joined = { slug: result.slug, formTitle: result.formTitle, formId: result.formId };
    else inviteInvalid = true;
  }

  await sendMail({
    to: email,
    subject: "Votre code de vérification MEAH COLLECT",
    text: `Bonjour ${firstName},\n\nVotre code de vérification est : ${verificationCode}\nIl expire dans 24 heures.\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
  });

  await audit(user.id, "user.signup", "user", user.id);
  return sessionResponse(
    user.id,
    passwordHash,
    { ok: true, needsVerification: true, joined, ...(inviteInvalid ? { inviteInvalid: true } : {}) },
    201
  );
}
