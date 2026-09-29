import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, safeParse, safeInt, safeLocalDate, audit } from "@/lib/api-utils";
import { getFormAccess, fieldsOfVersion } from "@/lib/forms-server";
import { formatAnswer } from "@/lib/fields";
import type { FormFieldDef, SubmissionRowDTO } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: { member: { include: { user: true } }; link: true };
}>;

// GET /api/forms/:id/submissions — F-01..F-03 (pagination, recherche, filtres)
// Vue membre : SES réponses uniquement (RM-05) · Vue initiateur : toutes (RM-06)
export async function GET(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const from = safeLocalDate(sp.get("from"));
  const to = safeLocalDate(sp.get("to"));
  const memberId = sp.get("member_id");
  const status = sp.get("status");
  const scope = sp.get("scope") === "all" && access.role === "owner" ? "all" : "mine";
  const limit = safeInt(sp.get("limit"), 50, 10, 100);
  const offset = safeInt(sp.get("offset"), 0, 0, 1_000_000);

  const where: Record<string, unknown> = { formId: id, deletedAt: null };
  if (scope === "mine") where.memberId = access.membership!.id;
  else if (memberId) where.memberId = memberId;
  if (from || to) {
    where.submittedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: new Date(to.getTime() + 86_399_000) } : {}),
    };
  }
  if (status && LEAD_STATUSES.includes(status)) where.leadStatus = status;

  // Colonnes depuis la version courante + libellés des versions impliquées
  const current = await db.formVersion.findFirst({
    where: { formId: id },
    orderBy: { versionNumber: "desc" },
    include: { fields: true },
  });
  const columns = fieldsOfVersion(current);

  const buildDto = (s: SubmissionWithRelations): SubmissionRowDTO | null => {
    const fields = fieldsByVersion.get(s.versionId) ?? columns;
    const raw = safeParse<Record<string, unknown>>(s.answers, {});
    const otherText: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.endsWith("_other") && typeof v === "string") otherText[k.replace(/_other$/, "")] = v;
      if (k.includes("__")) {
        const fk = k.split("__")[0];
        otherText[fk] = [otherText[fk], v].filter(Boolean).join(" — ");
      }
    }
    const values: Record<string, string> = {};
    for (const f of fields) {
      if (["section_title", "paragraph_text", "image_block", "callout", "divider", "page_break", "welcome_screen", "end_screen"].includes(f.type)) continue;
      values[f.key] = formatAnswer(f, raw[f.key] as never, { otherText });
    }
    // recherche plein texte (F-02) — appliquée AVANT pagination
    if (q) {
      const haystack = Object.values(values).join(" ").toLowerCase();
      if (!haystack.includes(q)) return null;
    }
    return {
      id: s.id,
      formId: s.formId,
      submittedAt: s.submittedAt.toISOString(),
      leadStatus: s.leadStatus,
      internalNote: s.internalNote,
      isFlagged: s.isFlagged,
      durationSec: s.durationSec,
      memberName: `${s.member.user.firstName} ${s.member.user.lastName}`,
      memberSlug: s.link?.slug ?? "",
      values,
      raw,
    };
  };

  // Résolution des versions impliquées
  const versionIdsPreview = await db.submission.findMany({
    where,
    select: { versionId: true },
    distinct: ["versionId"],
  });
  const versions = await db.formVersion.findMany({
    where: { id: { in: versionIdsPreview.map((v) => v.versionId) } },
    include: { fields: true },
  });
  const fieldsByVersion = new Map<string, FormFieldDef[]>(versions.map((v) => [v.id, fieldsOfVersion(v)]));

  let rows: SubmissionRowDTO[];
  let total: number;
  if (q) {
    // Recherche : filtrage en mémoire sur un périmètre borné, PUIS pagination cohérente.
    const candidates = await db.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 5000,
      include: { member: { include: { user: true } }, link: true },
    });
    const filtered = candidates.map(buildDto).filter(Boolean) as SubmissionRowDTO[];
    total = filtered.length;
    rows = filtered.slice(offset, offset + limit);
  } else {
    [total, rows] = await Promise.all([
      db.submission.count({ where }),
      db.submission
        .findMany({
          where,
          orderBy: { submittedAt: "desc" },
          take: limit,
          skip: offset,
          include: { member: { include: { user: true } }, link: true },
        })
        .then((found) => found.map(buildDto).filter(Boolean) as SubmissionRowDTO[]),
    ]);
  }

  // membres pour le filtre (vue initiateur uniquement)
  let members: { id: string; name: string }[] | undefined;
  if (scope === "all") {
    const ms = await db.formMember.findMany({
      where: { formId: id, status: { not: "removed" } },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });
    members = ms.map((m) => ({ id: m.id, name: `${m.user.firstName} ${m.user.lastName}` }));
  }

  return jsonOk({
    rows,
    total,
    offset,
    limit,
    columns,
    scope,
    members,
    formTitle: access.form.title,
  });
}

// PATCH /api/forms/:id/submissions — action groupée : statut sur plusieurs réponses (F.8 actions groupées)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  let body: { ids?: string[]; leadStatus?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const ids = (body.ids ?? []).filter((x) => typeof x === "string").slice(0, 1000);
  if (!ids.length || !body.leadStatus || !LEAD_STATUSES.includes(body.leadStatus)) {
    return jsonError("VALIDATION_FAILED", "Paramètres invalides.", 422);
  }

  const where: Record<string, unknown> = { id: { in: ids }, formId: id, deletedAt: null };
  if (access.role === "member") where.memberId = access.membership!.id;

  await db.submission.updateMany({ where, data: { leadStatus: body.leadStatus } });
  await audit(r.user.id, "submissions.status_bulk", "form", id, { count: ids.length, leadStatus: body.leadStatus });
  return jsonOk({ ok: true });
}
