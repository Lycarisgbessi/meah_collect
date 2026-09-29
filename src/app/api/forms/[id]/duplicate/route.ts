import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit } from "@/lib/api-utils";
import { getFormAccess } from "@/lib/forms-server";
import { genSlug } from "@/lib/crypto";

interface Ctx { params: Promise<{ id: string }> }

// POST /api/forms/:id/duplicate — B-08 : dupliquer un formulaire existant (initiateur uniquement)
export async function POST(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") {
    return jsonError("FORBIDDEN", "Seul l'initiateur peut dupliquer ce formulaire.", 403);
  }
  const src = access.form;

  const srcVersion = await db.formVersion.findFirst({
    where: { formId: src.id },
    orderBy: { versionNumber: "desc" },
  });
  const fields = srcVersion ? await db.formField.findMany({ where: { versionId: srcVersion.id } }) : [];

  const copyId = await db.$transaction(async (tx) => {
    const copy = await tx.form.create({
      data: {
        ownerId: r.user.id,
        title: `${src.title} (copie)`,
        description: src.description,
        theme: src.theme,
        settings: src.settings,
        mode: src.mode,
        displayMode: src.displayMode,
        status: "draft",
      },
    });
    const version = await tx.formVersion.create({
      data: { formId: copy.id, versionNumber: 1, isPublished: false },
    });
    await tx.form.update({ where: { id: copy.id }, data: { currentVersionId: version.id } });

    for (const f of fields) {
      await tx.formField.create({
        data: {
          versionId: version.id, key: f.key, label: f.label, type: f.type,
          isRequired: f.isRequired, position: f.position, options: f.options,
        },
      });
    }
    // Adhésion + lien de collecte du nouveau propriétaire
    const member = await tx.formMember.create({ data: { formId: copy.id, userId: r.user.id, role: "owner", status: "active" } });
    await tx.collectionLink.create({ data: { formId: copy.id, memberId: member.id, slug: genSlug(10) } });
    return copy.id;
  });

  await audit(r.user.id, "form.duplicated", "form", copyId, { sourceId: id });
  return jsonOk({ id: copyId }, 201);
}
