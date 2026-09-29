import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, getClientIp, rateLimit, safeParse } from "@/lib/api-utils";
import { fieldsOfVersion } from "@/lib/forms-server";
import type { InvitationPreviewDTO, FormFieldDef } from "@/lib/types";

interface Ctx { params: Promise<{ token: string }> }

// GET /api/invite/:token — aperçu public de la structure (C-02, écran 7)
// RM-02 : cette page ne permet JAMAIS de soumettre une réponse.
export async function GET(req: NextRequest, ctx: Ctx) {
  const ip = getClientIp(req);
  if (!rateLimit(`invite-view:${ip}`, 60, 60_000)) {
    return jsonError("RATE_LIMITED", "Trop de requêtes.", 429);
  }
  const { token } = await ctx.params;

  const inv = await db.teamInvitation.findUnique({
    where: { token },
    include: { form: { include: { owner: true } } },
  });
  if (!inv || !inv.isActive) {
    return jsonOk<InvitationPreviewDTO>({
      formTitle: "", formDescription: null, ownerName: "", fields: [],
      membersCount: 0, submissionsCount: 0, state: "invalid",
    });
  }
  if (inv.expiresAt && inv.expiresAt < new Date()) {
    return jsonOk<InvitationPreviewDTO>({
      formTitle: "", formDescription: null, ownerName: "", fields: [],
      membersCount: 0, submissionsCount: 0, state: "expired",
    });
  }
  if (inv.maxUses !== null && inv.usesCount >= inv.maxUses) {
    return jsonOk<InvitationPreviewDTO>({
      formTitle: "", formDescription: null, ownerName: "", fields: [],
      membersCount: 0, submissionsCount: 0, state: "full",
    });
  }

  const form = inv.form;
  // Aucune structure exposée pour un formulaire non ouvert (draft/archived).
  if (form.status !== "published" && form.status !== "closed") {
    return jsonOk<InvitationPreviewDTO>({
      formTitle: "", formDescription: null, ownerName: "", fields: [],
      membersCount: 0, submissionsCount: 0, state: "invalid",
    });
  }
  const current = await db.formVersion.findFirst({
    where: { formId: form.id },
    orderBy: { versionNumber: "desc" },
    include: { fields: true },
  });
  const fields: FormFieldDef[] = fieldsOfVersion(current);

  const membersCount = await db.formMember.count({ where: { formId: form.id, status: "active" } }) - 1;
  const submissionsCount = await db.submission.count({ where: { formId: form.id, deletedAt: null } });

  // Cas limites 5.4 : l'appelant (cookie de session éventuel) est-il déjà membre / initiateur ?
  let state: InvitationPreviewDTO["state"] = "ok";
  const { getSessionUser } = await import("@/lib/api-utils");
  const user = await getSessionUser();
  if (user) {
    if (form.ownerId === user.id) state = "self";
    else {
      const existing = await db.formMember.findUnique({
        where: { formId_userId: { formId: form.id, userId: user.id } },
      });
      if (existing && existing.status !== "removed") state = "already_member";
    }
  }

  return jsonOk<InvitationPreviewDTO>({
    formTitle: form.title,
    formDescription: form.description,
    ownerName: `${form.owner.firstName} ${form.owner.lastName}`,
    ownerAvatar: form.owner.avatarUrl,
    fields,
    membersCount: Math.max(0, membersCount),
    submissionsCount,
    state,
  });
}
