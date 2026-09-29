import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit, safeParse, sanitizeText, rateLimit } from "@/lib/api-utils";
import { genSlug } from "@/lib/crypto";
import { templateFields } from "@/lib/templates";
import type { FormSummaryDTO } from "@/lib/types";

// GET /api/forms — mes formulaires + équipes que j'ai rejointes (écran 3)
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const owned = await db.form.findMany({
    where: { ownerId: user.id, status: { not: "archived" } },
    include: {
      _count: { select: { submissions: { where: { deletedAt: null } }, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const todayOwned = await db.submission.groupBy({
    by: ["formId"],
    where: { form: { ownerId: user.id }, submittedAt: { gte: startOfDay }, deletedAt: null },
    _count: true,
  });
  const todayMap = new Map(todayOwned.map((t) => [t.formId, t._count]));

  const memberships = await db.formMember.findMany({
    where: { userId: user.id, role: "member", status: { not: "removed" } },
    include: {
      form: { include: { owner: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const forms: FormSummaryDTO[] = owned.map((form) => ({
    id: form.id,
    title: form.title,
    description: form.description,
    status: form.status as FormSummaryDTO["status"],
    mode: form.mode,
    displayMode: form.displayMode,
    theme: safeParse(form.theme, {}),
    settings: safeParse(form.settings, {}),
    submissionsCount: form._count.submissions,
    todayCount: todayMap.get(form.id) ?? 0,
    membersCount: Math.max(0, form._count.members - 1), // sans le propriétaire
    updatedAt: form.updatedAt.toISOString(),
    createdAt: form.createdAt.toISOString(),
    myRole: "owner",
  }));

  const joined: FormSummaryDTO[] = memberships.map((m) => ({
    id: m.form.id,
    title: m.form.title,
    description: m.form.description,
    status: m.form.status as FormSummaryDTO["status"],
    mode: m.form.mode,
    displayMode: m.form.displayMode,
    theme: safeParse(m.form.theme, {}),
    settings: {},
    submissionsCount: 0, // jamais le total global pour un membre (RM-05)
    todayCount: 0,
    membersCount: 0,
    updatedAt: m.form.updatedAt.toISOString(),
    createdAt: m.form.createdAt.toISOString(),
    ownerName: `${m.form.owner.firstName} ${m.form.owner.lastName}`,
    myRole: "member",
  }));

  return jsonOk({ forms, joined });
}

// POST /api/forms — créer un formulaire (vierge ou modèle) + version 1 + lien du propriétaire
export async function POST(req: NextRequest) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  // Anti-dérive : 20 créations / heure / utilisateur
  if (!rateLimit(`form-create:${user.id}`, 20, 3600_000)) {
    return jsonError("RATE_LIMITED", "Trop de formulaires créés. Réessayez plus tard.", 429);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide = vierge */
  }
  const templateId = typeof body.templateId === "string" ? body.templateId : "blank";
  const title = sanitizeText(body.title, 160) || "Nouveau formulaire";

  const tFields = templateFields(templateId);
  const formId = await db.$transaction(async (tx) => {
    const form = await tx.form.create({
      data: {
        ownerId: user.id,
        title,
        description: null,
        settings: JSON.stringify({
          showBranding: true,
          allowAnother: false,
          notifyOwner: true,
          notifyMember: true,
          finalMessage: "Merci ! Vos informations ont bien été envoyées.",
          consentText: "Vos données sont utilisées uniquement dans le cadre de cette collecte. Elles ne seront jamais partagées sans votre accord.",
        }),
      },
    });

    const version = await tx.formVersion.create({
      data: { formId: form.id, versionNumber: 1, isPublished: false },
    });
    await tx.form.update({ where: { id: form.id }, data: { currentVersionId: version.id } });

    let pos = 0;
    for (const tf of tFields) {
      await tx.formField.create({
        data: {
          versionId: version.id,
          key: tf.key,
          label: tf.label,
          type: tf.type,
          isRequired: tf.isRequired,
          position: pos,
          options: JSON.stringify(tf.options ?? {}),
        },
      });
      pos++;
    }

    // Adhésion + lien de collecte de l'initiateur (tout ou rien avec le formulaire)
    const existing = await tx.formMember.findUnique({ where: { formId_userId: { formId: form.id, userId: user.id } } });
    const member = existing ?? (await tx.formMember.create({ data: { formId: form.id, userId: user.id, role: "owner", status: "active" } }));
    await tx.collectionLink.create({ data: { formId: form.id, memberId: member.id, slug: genSlug(10) } });

    return form.id;
  });

  await audit(user.id, "form.created", "form", formId, { templateId });
  return jsonOk({ id: formId }, 201);
}
