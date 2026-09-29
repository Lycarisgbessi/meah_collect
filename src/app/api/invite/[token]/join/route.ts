import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit, rateLimit, getClientIp, safeParse } from "@/lib/api-utils";
import { joinTeamByToken } from "@/lib/team";
import type { FormSettings } from "@/lib/types";

interface Ctx { params: Promise<{ token: string }> }

// POST /api/invite/:token/join — rejoindre l'équipe → crée le lien dérivé (D-02, < 5 s)
export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (!rateLimit(`join:${getClientIp(req)}`, 20, 60_000)) {
    return jsonError("RATE_LIMITED", "Trop de requêtes.", 429);
  }
  const { token } = await ctx.params;

  const result = await joinTeamByToken(r.user.id, token);
  if (!result.ok) {
    return jsonError(result.code, result.message, result.code === "INVITATION_INVALID" ? 410 : 409);
  }

  if (!result.alreadyMember) {
    await audit(r.user.id, "member.joined", "form", result.formId);
    // E5 : notification à l'initiateur (Annexe G)
    const form = await db.form.findUnique({ where: { id: result.formId } });
    if (form) {
      const settings = safeParse<FormSettings>(form.settings, {});
      if (settings.notifyOwner !== false) {
        await db.notification.create({
          data: {
            userId: form.ownerId,
            type: "member_joined",
            payload: JSON.stringify({
              memberName: `${r.user.firstName} ${r.user.lastName}`,
              formTitle: result.formTitle,
              formId: result.formId,
            }),
          },
        });
      }
    }
  }

  return jsonOk({
    slug: result.slug,
    formId: result.formId,
    formTitle: result.formTitle,
    alreadyMember: result.alreadyMember,
  });
}
