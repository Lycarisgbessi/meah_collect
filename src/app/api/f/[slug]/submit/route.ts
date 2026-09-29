import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, getClientIp, rateLimit, ipHashOf, safeParse, sanitizeText } from "@/lib/api-utils";
import { validateAnswer, normalizePhone, formatAnswer, type AnswerValue } from "@/lib/fields";
import { getPublishedVersion } from "@/lib/forms-server";
import type { FormFieldDef, FormSettings } from "@/lib/types";

interface Ctx { params: Promise<{ slug: string }> }

// POST /api/f/:slug/submit — traitement d'une soumission (§7.4, étapes 1→8)
export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const ip = getClientIp(req);
  const ipHash = ipHashOf(req);

  // Étape 2 — anti-spam & limitation de débit (5/min/IP/lien ; 30/h/IP)
  if (!rateLimit(`submit:${slug}:${ip}`, 5, 60_000) || !rateLimit(`submit-ip:${ip}`, 30, 3600_000)) {
    return jsonError("RATE_LIMITED", "Trop de tentatives. Réessayez dans quelques minutes.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }

  // Piège anti-bot (honeypot) : champ invisible rempli → rejet silencieux (US-10)
  const honeypot = String(body._hp ?? "");
  const startedAt = Number(body.startedAt ?? 0);
  const elapsed = Date.now() - startedAt;

  // Étape 1 — résoudre le slug et vérifier les états
  const link = await db.collectionLink.findUnique({
    where: { slug },
    include: { member: { include: { user: true } }, form: true },
  });
  if (!link) return jsonError("LINK_INVALID", "Ce lien est introuvable.", 404);
  const form = link.form;
  const settings = safeParse<FormSettings>(form.settings, {});

  if (!link.isActive || link.member.status !== "active" || link.member.user.isSuspended) {
    return jsonError("MEMBER_INACTIVE", "Ce lien n'est plus actif.", 410);
  }
  if (form.status !== "published" || (settings.closesAt && new Date(settings.closesAt) < new Date())) {
    return jsonError("FORM_CLOSED", "Ce formulaire n'accepte plus de réponses.", 410);
  }
  if (settings.maxSubmissions) {
    const total = await db.submission.count({ where: { formId: form.id, deletedAt: null } });
    if (total >= settings.maxSubmissions) {
      return jsonError("QUOTA_REACHED", "Le nombre maximal de réponses a été atteint.", 410);
    }
  }

  // Étape 3 — validation depuis la dernière version PUBLIÉE (RM-07 : jamais un brouillon)
  const version = await getPublishedVersion(form.id);
  if (!version) return jsonError("FORM_NOT_PUBLISHED", "Ce formulaire n'est pas encore ouvert.", 409);
  const fields: FormFieldDef[] = (version.fields ?? [])
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ key: f.key, label: f.label, type: f.type as FormFieldDef["type"], isRequired: f.isRequired, position: f.position, options: safeParse(f.options, {}) }));

  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, AnswerValue> = {};
  const fieldErrors: Record<string, string> = {};
  const allowedKeys = new Set(fields.map((f) => f.key));
  // clés « autres (précisez) » autorisées : `${key}_other`
  const otherKeys = new Set<string>();
  for (const f of fields) {
    if ((f.options.choices ?? []).some((c) => c.allowText)) otherKeys.add(`${f.key}_other`);
  }

  // Rejet de toute clé non déclarée (Annexe E, règles transverses) — sauf le champ piège __hp
  for (const k of Object.keys(rawAnswers)) {
    if (k === "__hp") continue;
    // seules les clés « autre (précisez) » réellement autorisées par un champ passent
    if (!allowedKeys.has(k) && !otherKeys.has(k)) {
      return jsonError("VALIDATION_FAILED", "Des champs non autorisés ont été détectés.", 422);
    }
  }

  for (const f of fields) {
    let value = rawAnswers[f.key] as AnswerValue;
    if (f.type === "hidden") {
      // champ caché : valeur fixe ou issue du lien (identifiant du membre collecteur, QA-13)
      value = typeof rawAnswers[f.key] === "string" && String(rawAnswers[f.key]).length <= 200 ? String(rawAnswers[f.key]) : `Lien de ${link.member.user.firstName}`;
    }
    if (f.type === "email" && typeof value === "string") value = value.trim().toLowerCase();
    if (f.type === "phone" && typeof value === "string") value = normalizePhone(value, f.options.defaultCountry ?? "FR");
    if ((f.type === "short_text" || f.type === "long_text" || f.type === "first_name" || f.type === "last_name" || f.type === "full_name" || f.type === "company" || f.type === "job_title" || f.type === "city") && typeof value === "string") {
      value = sanitizeText(value, f.type === "long_text" ? 5000 : 500);
    }
    const err = validateAnswer(f, value);
    if (err) fieldErrors[f.key] = err;
    answers[f.key] = value ?? null;
    if (otherKeys.has(`${f.key}_other`)) {
      const other = sanitizeText(rawAnswers[`${f.key}_other`], 200);
      if (answers[f.key] === `${f.key}:other` || (typeof answers[f.key] === "string" && (f.options.choices ?? []).find((c) => c.value === answers[f.key])?.allowText)) {
        answers[`${f.key}_other`] = other || null;
        if (f.isRequired && !other) fieldErrors[`${f.key}_other`] = "Précisez votre réponse.";
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return jsonError("VALIDATION_FAILED", "Certains champs nécessitent votre attention.", 422, fieldErrors);
  }

  // Étape 4 — contrôles anti-spam après validation
  if (honeypot.trim() !== "" || (startedAt > 0 && elapsed < 2000)) {
    // Soumission enregistrée mais marquée (US-10 : rejet silencieux ou flag)
    const flagged = await db.submission.create({
      data: {
        formId: form.id, versionId: version.id, linkId: link.id, memberId: link.member.id,
        answers: JSON.stringify(answers), isFlagged: true, ipHash, userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        durationSec: startedAt > 0 ? Math.round(elapsed / 1000) : null,
      },
    });
    void flagged;
    // Réponse de succès factice pour ne pas révéler le piège
    return jsonOk({ ok: true, message: "Merci ! Vos informations ont bien été envoyées." }, 201);
  }

  // Étape 5 — détection de doublons (Annexe E : clé composite par formulaire)
  if (settings.dedup?.enabled && settings.dedup.keys?.length) {
    const emailField = fields.find((f) => f.type === "email");
    const phoneField = fields.find((f) => f.type === "phone");
    const checks: Record<string, unknown>[] = [];
    if (settings.dedup.keys.includes("email") && emailField && typeof answers[emailField.key] === "string" && answers[emailField.key]) {
      checks.push({ formId: form.id, deletedAt: null, answers: { contains: `"${answers[emailField.key]}"` } });
    }
    if (settings.dedup.keys.includes("phone") && phoneField && typeof answers[phoneField.key] === "string" && answers[phoneField.key]) {
      checks.push({ formId: form.id, deletedAt: null, answers: { contains: `"${answers[phoneField.key]}"` } });
    }
    if (checks.length) {
      const dup = await db.submission.findFirst({ where: { OR: checks } });
      if (dup) {
        if (settings.dedup.mode === "block") {
          return jsonError("DUPLICATE_SUBMISSION", "Ces informations ont déjà été enregistrées.", 409);
        }
        // mode « warn » : accepté mais signalé
      }
    }
  }

  // Étape 6 — insertion (answers est notre source unique, Annexe C alternative de performance)
  const created = await db.submission.create({
    data: {
      formId: form.id, versionId: version.id, linkId: link.id, memberId: link.member.id,
      answers: JSON.stringify(answers),
      ipHash, userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      durationSec: startedAt > 0 ? Math.min(Math.round(elapsed / 1000), 86400) : null,
    },
  });

  // Étape 7 — notifications asynchrones (Annexe G, E6)
  const memberSettings = link.member.user;
  const notifyMember = settings.notifyMember !== false && memberSettings.notifyOnResponse;
  const notifyOwner = settings.notifyOwner !== false;
  const summaryKeys = fields.filter((f) => ["first_name", "last_name", "full_name", "email", "phone"].includes(f.type)).slice(0, 3);
  const summary = summaryKeys.map((f) => ({ label: f.label, value: formatAnswer(f, answers[f.key]) }));
  const payload = JSON.stringify({ formTitle: form.title, formId: form.id, submissionId: created.id, count: 1, summary });

  const notifCreations: { userId: string }[] = [];
  if (notifyMember) notifCreations.push({ userId: link.member.userId });
  if (notifyOwner && link.member.userId !== form.ownerId) notifCreations.push({ userId: form.ownerId });
  if (notifCreations.length) {
    await db.notification.createMany({
      data: notifCreations.map((n) => ({ userId: n.userId, type: "new_submission", payload })),
    });
  }

  // Étape 8 — succès sans identifiants internes (Annexe D.2)
  return jsonOk({
    ok: true,
    message: settings.finalMessage || "Merci ! Vos informations ont bien été envoyées.",
    allowAnother: !!settings.allowAnother,
  }, 201);
}
