import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { genToken } from "@/lib/crypto";
import { jsonOk, jsonError, requireUser, audit, safeIsoDate } from "@/lib/api-utils";
import { getFormAccess } from "@/lib/forms-server";
import type { InvitationDTO } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

function dto(i: { id: string; token: string; isActive: boolean; expiresAt: Date | null; maxUses: number | null; usesCount: number; createdAt: Date }): InvitationDTO {
  return {
    id: i.id, token: i.token, isActive: i.isActive,
    expiresAt: i.expiresAt?.toISOString() ?? null,
    maxUses: i.maxUses, usesCount: i.usesCount,
    createdAt: i.createdAt.toISOString(),
  };
}

// GET /api/forms/:id/invitation — lien d'invitation courant (C-01)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const invitations = await db.teamInvitation.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return jsonOk({ invitations: invitations.map(dto) });
}

// POST /api/forms/:id/invitation — générer / régénérer (annule l'ancien token, Annexe B.3)
export async function POST(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  await db.teamInvitation.updateMany({ where: { formId: id, isActive: true }, data: { isActive: false } });
  const inv = await db.teamInvitation.create({
    data: { formId: id, token: genToken(32), createdBy: r.user.id },
  });
  await audit(r.user.id, "invitation.generated", "form", id);
  return jsonOk({ invitation: dto(inv) }, 201);
}

// PATCH /api/forms/:id/invitation — options : expiration, quota (C-03)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  let body: { invitationId?: string; expiresAt?: string | null; maxUses?: number | null };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  if (!body.invitationId) return jsonError("VALIDATION_FAILED", "invitationId requis.", 422);
  const data: Record<string, unknown> = {};
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") data.expiresAt = null;
    else {
      const d = safeIsoDate(body.expiresAt);
      if (!d) return jsonError("VALIDATION_FAILED", "Date d'expiration invalide.", 422);
      data.expiresAt = d;
    }
  }
  if (body.maxUses !== undefined) {
    if (body.maxUses === null) data.maxUses = null;
    else {
      const n = Math.trunc(Number(body.maxUses));
      if (!Number.isFinite(n) || n < 1) return jsonError("VALIDATION_FAILED", "Quota invalide.", 422);
      data.maxUses = Math.min(10000, n);
    }
  }
  const existing = await db.teamInvitation.findFirst({ where: { id: body.invitationId, formId: id } });
  if (!existing) return jsonError("NOT_FOUND", "Invitation introuvable.", 404);
  const inv = await db.teamInvitation.update({ where: { id: existing.id }, data });
  return jsonOk({ invitation: dto(inv) });
}

// DELETE /api/forms/:id/invitation — révoquer (le lien révoqué ne se réactive pas, Annexe B.3)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access || access.role !== "owner") return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const url = new URL(req.url);
  const invitationId = url.searchParams.get("invitationId");
  if (!invitationId) return jsonError("VALIDATION_FAILED", "invitationId requis.", 422);
  const existing = await db.teamInvitation.findFirst({ where: { id: invitationId, formId: id } });
  if (!existing) return jsonError("NOT_FOUND", "Invitation introuvable.", 404);
  await db.teamInvitation.update({ where: { id: existing.id }, data: { isActive: false } });
  await audit(r.user.id, "invitation.revoked", "form", id);
  return jsonOk({ ok: true });
}
