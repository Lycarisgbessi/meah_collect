import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, getClientIp, rateLimit, safeParse } from "@/lib/api-utils";
import { fieldsOfVersion, getPublishedVersion } from "@/lib/forms-server";
import type { PublicFormDTO, FormFieldDef, FormSettings } from "@/lib/types";

interface Ctx { params: Promise<{ slug: string }> }

/** Settings exposés au répondant — jamais la configuration interne (dedup, notifications…). */
function publicSettings(s: FormSettings): FormSettings {
  return {
    finalMessage: s.finalMessage ?? "Merci ! Vos informations ont bien été envoyées.",
    redirectUrl: s.redirectUrl,
    consentText: s.consentText,
    introText: s.introText,
    showBranding: s.showBranding,
    allowAnother: s.allowAnother,
    estimateMinutes: s.estimateMinutes,
  };
}

// GET /api/f/:slug — données minimales pour le rendu public (Annexe D.2)
// Ne renvoie JAMAIS d'identifiant interne ni de données sensibles de l'initiateur.
export async function GET(req: NextRequest, ctx: Ctx) {
  const ip = getClientIp(req);
  if (!rateLimit(`f-view:${ip}`, 120, 60_000)) {
    return jsonError("RATE_LIMITED", "Trop de requêtes.", 429);
  }
  const { slug } = await ctx.params;

  const link = await db.collectionLink.findUnique({
    where: { slug },
    include: {
      member: { include: { user: true } },
      form: true,
    },
  });
  if (!link) return jsonError("LINK_INVALID", "Ce lien est introuvable.", 404);

  const form = link.form;
  const settings = safeParse<FormSettings>(form.settings, {});

  // États gérés : E-09 (lien invalide, formulaire clos, membre désactivé, quota atteint)
  if (!link.isActive || link.member.status !== "active" || link.member.user.isSuspended) {
    return jsonError("MEMBER_INACTIVE", "Ce lien n'est plus actif.", 410, { state: "member_inactive" });
  }
  if (form.status === "draft" || form.status === "archived") {
    return jsonError("FORM_NOT_PUBLISHED", "Ce formulaire n'est pas encore ouvert.", 409, { state: "not_published" });
  }
  if (form.status === "closed" || (settings.closesAt && new Date(settings.closesAt) < new Date())) {
    return jsonError("FORM_CLOSED", "Ce formulaire n'accepte plus de réponses.", 410, { state: "closed" });
  }
  if (settings.maxSubmissions) {
    const total = await db.submission.count({ where: { formId: form.id, deletedAt: null } });
    if (total >= settings.maxSubmissions) {
      return jsonError("QUOTA_REACHED", "Le nombre maximal de réponses a été atteint.", 410, { state: "quota" });
    }
  }

  // RM-07 : le public voit la dernière version PUBLIÉE, jamais un brouillon en cours d'édition.
  const current = await getPublishedVersion(form.id);
  const fields: FormFieldDef[] = fieldsOfVersion(current);

  const dto: PublicFormDTO = {
    slug,
    title: form.title,
    description: form.description,
    theme: safeParse(form.theme, {}),
    settings: publicSettings(settings),
    displayMode: form.displayMode,
    fields,
    collectorName: `${link.member.user.firstName} ${link.member.user.lastName}`,
    collectorAvatar: link.member.user.avatarUrl,
    isOwnerLink: link.member.role === "owner",
    brandName: "MEAH COLLECT",
  };
  return jsonOk(dto);
}
