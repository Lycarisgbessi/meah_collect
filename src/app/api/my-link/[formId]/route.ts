import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, safeParse } from "@/lib/api-utils";
import { getFormAccess, settingsOf } from "@/lib/forms-server";

interface Ctx { params: Promise<{ formId: string }> }

// GET /api/my-link/:formId — « Mon lien » (D-03), pour l'initiateur comme pour les membres.
// On ne voit que SES indicateurs, jamais les stats globales (réponse QO n°5).
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { formId } = await ctx.params;

  const access = await getFormAccess(formId, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  // L'initiateur a aussi une adhésion owner (ensureOwnerMembership) — on la résout dans tous les cas.
  const membership =
    access.membership ??
    (await db.formMember.findUnique({ where: { formId_userId: { formId, userId: r.user.id } } }));
  if (!membership) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const link = await db.collectionLink.findUnique({ where: { memberId: membership.id } });
  if (!link) return jsonError("NOT_FOUND", "Lien introuvable.", 404);

  const form = access.form;
  const settings = settingsOf(form);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const base = { formId, memberId: membership.id, deletedAt: null };

  const [total, today, last7] = await Promise.all([
    db.submission.count({ where: base }),
    db.submission.count({ where: { ...base, submittedAt: { gte: startOfDay } } }),
    db.submission.count({ where: { ...base, submittedAt: { gte: d7 } } }),
  ]);

  const owner = await db.user.findUnique({ where: { id: form.ownerId } });

  return jsonOk({
    slug: link.slug,
    isActive: link.isActive && membership.status === "active",
    memberStatus: membership.status,
    myRole: access.role,
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      status: form.status,
      theme: safeParse(form.theme, {}),
      settings,
    },
    ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "",
    stats: { total, today, last7 },
  });
}
