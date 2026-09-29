import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit, sanitizeText } from "@/lib/api-utils";
import {
  getFormAccess,
  getFormWithCurrentVersion,
  fieldsOfVersion,
  saveStructure,
  themeOf,
  settingsOf,
  sanitizeTheme,
  sanitizeSettings,
  isValidFieldType,
} from "@/lib/forms-server";
import type { FormFieldDef } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

// GET /api/forms/:id — détail + structure de la version courante
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const access = await getFormAccess(id, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);
  const { form, role } = access;

  const full = await getFormWithCurrentVersion(id);
  const fields = fieldsOfVersion(full?.versions[0] ?? null);
  const owner = await db.user.findUnique({ where: { id: form.ownerId } });

  // Le lien personnel existe pour l'initiateur comme pour les membres (ensureOwnerMembership).
  const myMembership =
    access.membership ??
    (await db.formMember.findUnique({ where: { formId_userId: { formId: id, userId: r.user.id } } }));
  const myLink = myMembership
    ? await db.collectionLink.findUnique({ where: { memberId: myMembership.id } })
    : null;

  return jsonOk({
    id: form.id,
    title: form.title,
    description: form.description,
    status: form.status,
    mode: form.mode,
    displayMode: form.displayMode,
    theme: themeOf(form),
    settings: settingsOf(form),
    myRole: role,
    versionNumber: full?.versions[0]?.versionNumber ?? 1,
    fields,
    myLink: myLink ? { slug: myLink.slug, isActive: myLink.isActive } : null,
    ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "",
  });
}

// PATCH /api/forms/:id — titre, description, thème, réglages, mode d'affichage
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") {
    return jsonError("FORBIDDEN", "Seul l'initiateur peut modifier ce formulaire. (RM-01)", 403);
  }
  if (access.form.status === "archived") {
    return jsonError("FORM_LOCKED", "Ce formulaire est archivé : il est figé. (RM-01)", 409);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = sanitizeText(body.title, 160) || "Sans titre";
  if (typeof body.description === "string") data.description = sanitizeText(body.description, 600);
  // theme/settings : fusion whitelistée — aucune clé arbitraire n'entre en base.
  if (body.theme && typeof body.theme === "object") {
    data.theme = JSON.stringify(sanitizeTheme(body.theme, themeOf(access.form)));
  }
  if (body.settings && typeof body.settings === "object") {
    data.settings = JSON.stringify(sanitizeSettings(body.settings, settingsOf(access.form)));
  }
  if (body.displayMode === "single_page" || body.displayMode === "multi_step") data.displayMode = body.displayMode;

  if (Object.keys(data).length === 0) return jsonOk({ ok: true });

  await db.form.update({ where: { id }, data });
  await audit(r.user.id, "form.updated", "form", id, Object.fromEntries(Object.keys(data).map((k) => [k, true])));
  return jsonOk({ ok: true });
}

// PUT /api/forms/:id/structure — sauvegarde des champs avec versionnage (RM-07)
export async function PUT(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") {
    return jsonError("FORBIDDEN", "Seul l'initiateur peut modifier la structure. (RM-01)", 403);
  }
  if (access.form.status === "archived" || access.form.status === "closed") {
    return jsonError("FORM_LOCKED", "Ce formulaire est clôturé : sa structure est figée.", 409);
  }

  let body: { fields?: FormFieldDef[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const fields = Array.isArray(body.fields) ? body.fields : [];
  if (fields.length > 100) return jsonError("VALIDATION_FAILED", "Maximum 100 champs par formulaire.", 422);
  // Types restreints au catalogue Q.3 — jamais de type arbitraire servi au public.
  const invalid = fields.filter((f) => !f || typeof f.type !== "string" || !isValidFieldType(f.type));
  if (invalid.length) {
    return jsonError("VALIDATION_FAILED", "Certains types de champs ne sont pas supportés.", 422);
  }

  const { versionId, newVersion } = await saveStructure(access.form, fields);
  await audit(r.user.id, newVersion ? "form.new_version" : "form.structure_saved", "form", id, { fields: fields.length });
  return jsonOk({ ok: true, versionId, newVersion });
}

// DELETE /api/forms/:id — suppression (formulaires non publiés)
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") {
    return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);
  }
  if (access.form.status === "published") {
    return jsonError("FORM_PUBLISHED", "Dépubliez ou clôturez le formulaire avant de le supprimer.", 409);
  }
  // Les réponses référencent version/liens/membres en Restrict → purge explicite, en transaction.
  await db.$transaction([
    db.submission.deleteMany({ where: { formId: id } }),
    db.export.deleteMany({ where: { formId: id } }),
    db.abuseReport.deleteMany({ where: { formId: id } }),
    db.notification.deleteMany({ where: { payload: { contains: id } } }),
    db.form.delete({ where: { id } }),
  ]);
  await audit(r.user.id, "form.deleted", "form", id);
  return jsonOk({ ok: true });
}
