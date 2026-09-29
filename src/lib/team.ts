// ============================================================
// Logique d'équipe partagée — rejoindre une équipe (Annexe C join_team)
// ============================================================

import { db } from "./db";
import { genSlug } from "./crypto";

export type JoinResult =
  | { ok: true; slug: string; formId: string; formTitle: string; alreadyMember: boolean }
  | { ok: false; code: "INVITATION_INVALID" | "FORM_NOT_PUBLISHED" | "RATE_LIMITED"; message: string };

/** Rejoindre une équipe via un token d'invitation (idempotent — RM-03/04). */
export async function joinTeamByToken(userId: string, token: string): Promise<JoinResult> {
  const inv = await db.teamInvitation.findUnique({ where: { token }, include: { form: true } });
  if (
    !inv ||
    !inv.isActive ||
    (inv.expiresAt && inv.expiresAt < new Date()) ||
    (inv.maxUses !== null && inv.usesCount >= inv.maxUses)
  ) {
    return {
      ok: false,
      code: "INVITATION_INVALID",
      message: "Ce lien d'invitation n'est plus valide. Contactez la personne qui vous l'a envoyé.",
    };
  }
  const form = inv.form;
  if (form.status !== "published" && form.status !== "closed") {
    return { ok: false, code: "FORM_NOT_PUBLISHED", message: "Ce formulaire n'est pas encore ouvert." };
  }
  // initiateur tentant de rejoindre sa propre équipe → refus calme
  if (form.ownerId === userId) {
    return { ok: false, code: "INVITATION_INVALID", message: "Vous êtes l'initiateur de ce formulaire." };
  }

  const existing = await db.formMember.findUnique({
    where: { formId_userId: { formId: form.id, userId } },
    include: { link: true },
  });
  if (existing) {
    if (existing.status === "removed") {
      // réactivation (retour dans l'équipe)
      await db.formMember.update({ where: { id: existing.id }, data: { status: "active", invitationId: inv.id } });
    }
    const slug = existing.link?.slug ?? (await ensureLink(existing.id, form.id));
    return { ok: true, slug, formId: form.id, formTitle: form.title, alreadyMember: true };
  }

  // Création + incrément atomiques : le quota maxUses ne peut pas être dépassé par des joins concurrents.
  let slug: string;
  try {
    slug = await db.$transaction(async (tx) => {
      const fresh = await tx.teamInvitation.findUnique({ where: { id: inv.id }, select: { usesCount: true, maxUses: true, isActive: true } });
      if (!fresh || !fresh.isActive || (fresh.maxUses !== null && fresh.usesCount >= fresh.maxUses)) {
        throw new Error("INVITATION_INVALID");
      }
      const member = await tx.formMember.create({
        data: { formId: form.id, userId, invitationId: inv.id, role: "member", status: "active" },
      });
      await tx.teamInvitation.update({ where: { id: inv.id }, data: { usesCount: { increment: 1 } } });
      // Lien dérivé (collisions de slug quasi impossibles, 5 tentatives)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const created = await tx.collectionLink.create({ data: { formId: form.id, memberId: member.id, slug: genSlug(10) } });
          return created.slug;
        } catch {
          // collision → nouvel essai
        }
      }
      throw new Error("SLUG_GENERATION_FAILED");
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITATION_INVALID") {
      return { ok: false, code: "INVITATION_INVALID", message: "Ce lien d'invitation n'est plus valide. Contactez la personne qui vous l'a envoyé." };
    }
    throw err;
  }
  return { ok: true, slug, formId: form.id, formTitle: form.title, alreadyMember: false };
}

/** Crée le lien dérivé unique d'un membre (RM-03). */
export async function ensureLink(memberId: string, formId: string): Promise<string> {
  const existing = await db.collectionLink.findUnique({ where: { memberId } });
  if (existing) return existing.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = genSlug(10);
    try {
      await db.collectionLink.create({ data: { formId, memberId, slug } });
      return slug;
    } catch {
      // collision de slug → nouvel essai
    }
  }
  throw new Error("SLUG_GENERATION_FAILED");
}

/** Le propriétaire obtient aussi un lien de collecte personnel (Annexe C trigger on_form_created). */
export async function ensureOwnerMembership(formId: string, ownerId: string) {
  const existing = await db.formMember.findUnique({ where: { formId_userId: { formId, userId: ownerId } } });
  const member =
    existing ??
    (await db.formMember.create({ data: { formId, userId: ownerId, role: "owner", status: "active" } }));
  await ensureLink(member.id, formId);
  return member.id;
}
