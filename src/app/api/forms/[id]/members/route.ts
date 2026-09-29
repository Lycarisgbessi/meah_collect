import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit } from "@/lib/api-utils";
import { getFormAccess } from "@/lib/forms-server";
import type { MemberDTO } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

// GET /api/forms/:id/members — liste de l'équipe avec statistiques (C-04, C-07)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const start7 = new Date(Date.now() - 7 * 86400_000);
  const members = await db.formMember.findMany({
    where: { formId: id, status: { not: "removed" } },
    include: { user: true, link: true, _count: { select: { submissions: { where: { deletedAt: null } } } } },
    orderBy: { joinedAt: "asc" },
  });

  const recent = await db.submission.groupBy({
    by: ["memberId"],
    where: { formId: id, submittedAt: { gte: start7 }, deletedAt: null },
    _count: true,
  });
  const recentMap = new Map(recent.map((x) => [x.memberId, x._count]));

  const dtos: MemberDTO[] = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role as "owner" | "member",
    status: m.status as MemberDTO["status"],
    joinedAt: m.joinedAt.toISOString(),
    slug: m.link?.slug,
    slugActive: m.link?.isActive ?? false,
    submissionsCount: m._count.submissions,
    last7: recentMap.get(m.id) ?? 0,
  }));

  return jsonOk({ members: dtos });
}

// PATCH /api/forms/:id/members — activer / désactiver / retirer (C-05, RM-08)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  let body: { memberId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  if (!body.memberId || !["active", "disabled", "removed"].includes(body.status ?? "")) {
    return jsonError("VALIDATION_FAILED", "Paramètres invalides.", 422);
  }

  const member = await db.formMember.findFirst({ where: { id: body.memberId, formId: id } });
  if (!member) return jsonError("NOT_FOUND", "Membre introuvable.", 404);
  if (member.role === "owner") return jsonError("FORBIDDEN", "L'initiateur ne peut pas être modifié.", 403);

  await db.formMember.update({ where: { id: member.id }, data: { status: body.status } });
  if (body.status === "removed") {
    await db.collectionLink.updateMany({ where: { memberId: member.id }, data: { isActive: false } });
  } else if (body.status === "active") {
    await db.collectionLink.updateMany({ where: { memberId: member.id }, data: { isActive: true } });
  } else if (body.status === "disabled") {
    // RM-08 : le lien cesse d'accepter des réponses ; les données restent accessibles à l'initiateur
    await db.collectionLink.updateMany({ where: { memberId: member.id }, data: { isActive: false } });
  }

  await audit(r.user.id, `member.${body.status}`, "form_member", member.id);
  return jsonOk({ ok: true });
}
