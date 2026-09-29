import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit, sanitizeText } from "@/lib/api-utils";

interface Ctx { params: Promise<{ id: string }> }

// PATCH /api/submissions/:id — F-07/F-08 : statut + note interne
// Un membre ne modifie que SES réponses ; l'initiateur toutes celles de son formulaire.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const submission = await db.submission.findUnique({ where: { id }, include: { form: true } });
  if (!submission || submission.deletedAt) return jsonError("NOT_FOUND", "Réponse introuvable.", 404);

  const isOwner = submission.form.ownerId === r.user.id;
  if (!isOwner) {
    const membership = await db.formMember.findUnique({ where: { id: submission.memberId } });
    if (!membership || membership.userId !== r.user.id || membership.status === "removed") {
      return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);
    }
  }

  let body: { leadStatus?: string; internalNote?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const data: Record<string, unknown> = {};
  if (body.leadStatus && ["new", "contacted", "qualified", "converted", "lost"].includes(body.leadStatus)) {
    data.leadStatus = body.leadStatus;
  }
  if (typeof body.internalNote === "string") data.internalNote = sanitizeText(body.internalNote, 2000) || null;

  await db.submission.update({ where: { id }, data });
  await audit(r.user.id, "submission.updated", "submission", id, data);
  return jsonOk({ ok: true });
}

// DELETE /api/submissions/:id — suppression avec confirmation + journalisation (F-07)
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const submission = await db.submission.findUnique({ where: { id }, include: { form: true } });
  if (!submission || submission.deletedAt) return jsonError("NOT_FOUND", "Réponse introuvable.", 404);

  const isOwner = submission.form.ownerId === r.user.id;
  if (!isOwner) {
    return jsonError("FORBIDDEN", "Seul l'initiateur peut supprimer une réponse.", 403);
  }

  // Suppression logique 30 j avant purge physique (Annexe B.5)
  await db.submission.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(r.user.id, "submission.deleted", "submission", id);
  return jsonOk({ ok: true });
}
