import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit, safeParse, safeLocalDate } from "@/lib/api-utils";
import { getFormAccess, fieldsOfVersion, getFormWithCurrentVersion } from "@/lib/forms-server";
import { formatAnswer } from "@/lib/fields";
import { buildXlsx, buildPdf, buildCsv, type ExportPayload } from "@/lib/exporters";
import fs from "fs";
import path from "path";
import os from "os";
import type { FormFieldDef } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

const EXPORT_DIR = path.join(os.tmpdir(), "meah-collect-exports");
const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"];
const ASYNC_THRESHOLD = 5000;

type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: { member: { include: { user: true } }; link: true };
}>;

/** Purge opportuniste des fichiers d'export expirés (appelée à chaque création). */
async function purgeExpiredExports(): Promise<void> {
  try {
    const expired = await db.export.findMany({
      where: { filePath: { not: null }, expiresAt: { lt: new Date() } },
      select: { id: true, filePath: true },
      take: 50,
    });
    for (const e of expired) {
      if (e.filePath) {
        try { fs.unlinkSync(e.filePath); } catch { /* fichier déjà absent */ }
      }
      await db.export.update({ where: { id: e.id }, data: { filePath: null, status: "expired" } });
    }
  } catch {
    // la purge ne doit jamais bloquer un export
  }
}

// POST /api/forms/:id/exports — F-11..F-16 (synchrone ≤ 5000 lignes, asynchrone au-delà)
export async function POST(req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  let body: { format?: string; filters?: Record<string, string | undefined> };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }
  const format = body.format === "pdf" ? "pdf" : body.format === "csv" ? "csv" : "xlsx";
  const filters = body.filters ?? {};

  const scope: "all" | "mine" = access.role === "owner" ? "all" : "mine";

  // Filtres identiques à la liste (dates validées, statut validé, recherche q honorée)
  const from = safeLocalDate(filters.from);
  const to = safeLocalDate(filters.to);
  const where: Record<string, unknown> = { formId: id, deletedAt: null };
  if (scope === "mine") where.memberId = access.membership!.id;
  else if (filters.member_id) where.memberId = filters.member_id;
  if (from || to) {
    where.submittedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: new Date(to.getTime() + 86_399_000) } : {}),
    };
  }
  if (filters.status && LEAD_STATUSES.includes(filters.status)) where.leadStatus = filters.status;

  const submissions = await db.submission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: { member: { include: { user: true } }, link: true },
  });

  void purgeExpiredExports();

  if (submissions.length > ASYNC_THRESHOLD) {
    // F-14 : asynchrone avec notification et lien temporaire
    const record = await db.export.create({
      data: {
        userId: r.user.id, formId: id, format,
        filters: JSON.stringify({ ...filters, scope }),
        status: "queued",
      },
    });
    void generateAsync(record.id, id, r.user.id, format, filters, scope);
    return jsonOk({ export_id: record.id, status: "queued", total: submissions.length }, 202);
  }

  // Les réponses déjà chargées sont réutilisées (pas de double lecture) ;
  // le filtre texte q est appliqué dans buildPayload (cohérence export ↔ écran).
  const { payload, rowCount } = await buildPayload(access, filters, scope, submissions);
  payload.meta.generatedBy = `${r.user.firstName} ${r.user.lastName}`;

  let buffer: Buffer;
  let mime: string;
  let ext: string;
  if (format === "xlsx") {
    buffer = await buildXlsx(payload);
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  } else if (format === "pdf") {
    buffer = buildPdf(payload);
    mime = "application/pdf";
    ext = "pdf";
  } else {
    buffer = buildCsv(payload);
    mime = "text/csv; charset=utf-8";
    ext = "csv";
  }

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  const fileName = `export-meah-collect-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  const record = await db.export.create({
    data: {
      userId: r.user.id, formId: id, format,
      filters: JSON.stringify({ ...filters, scope }),
      status: "ready", filePath, rowCount,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  await audit(r.user.id, "export.created", "form", id, { format, rowCount, scope });

  return jsonOk({
    export_id: record.id,
    status: "ready",
    row_count: rowCount,
    download_url: `/api/exports/${record.id}/download`,
    file_name: fileName,
    mime,
    generatedBy: payload.meta.generatedBy,
  }, 200);
}

async function buildPayload(
  access: NonNullable<Awaited<ReturnType<typeof getFormAccess>>>,
  filters: Record<string, string | undefined>,
  scope: "all" | "mine",
  submissions: SubmissionWithRelations[]
): Promise<{ payload: ExportPayload; rowCount: number }> {
  const formId = access.form.id;
  const full = await getFormWithCurrentVersion(formId);
  const allFields = fieldsOfVersion(full?.versions[0] ?? null);
  const fields: FormFieldDef[] = allFields.filter(
    (f) => !["section_title", "paragraph_text", "image_block", "callout", "divider", "page_break", "welcome_screen", "end_screen"].includes(f.type)
  );

  const q = (filters.q ?? "").trim().toLowerCase();

  const versionIds = [...new Set(submissions.map((s) => s.versionId))];
  const versions = await db.formVersion.findMany({ where: { id: { in: versionIds } }, include: { fields: true } });
  const fieldsByVersion = new Map<string, FormFieldDef[]>(versions.map((v) => [v.id, fieldsOfVersion(v)]));

  let memberFilterName: string | undefined;
  if (filters.member_id) {
    const m = await db.formMember.findUnique({ where: { id: filters.member_id }, include: { user: true } });
    memberFilterName = m ? `${m.user.firstName} ${m.user.lastName}` : undefined;
  }

  const rows: Record<string, string>[] = [];
  for (const s of submissions) {
    const fieldsV = fieldsByVersion.get(s.versionId) ?? fields;
    const raw = safeParse<Record<string, unknown>>(s.answers, {});
    const otherText: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.endsWith("_other") && typeof v === "string") otherText[k.replace(/_other$/, "")] = v;
    }
    const row: Record<string, string> = {};
    for (const f of fields) {
      // utilise le champ de la version de la soumission si la clé existe encore
      const fv = fieldsV.find((x) => x.key === f.key) ?? f;
      row[f.key] = formatAnswer(fv, raw[f.key] as never, { otherText });
    }
    // filtre texte identique à la liste (F-02)
    if (q) {
      const haystack = fields.map((f) => row[f.key] ?? "").join(" ").toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    const d = s.submittedAt;
    row.__date = d.toLocaleDateString("fr-FR");
    row.__time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    row.__collector = `${s.member.user.firstName} ${s.member.user.lastName}`;
    rows.push(row);
  }

  return {
    rowCount: rows.length,
    payload: {
      formTitle: access.form.title,
      fields,
      rows,
      meta: {
        collectedBy: scope === "all",
        collectedByName: memberFilterName,
        scope: scope === "all" ? "Toutes les réponses (vue initiateur)" : "Mes réponses",
        filters,
        generatedBy: "",
        totalRows: rows.length,
      },
    },
  };
}

// F-14 : génération asynchrone
async function generateAsync(exportId: string, formId: string, userId: string, format: string, filters: Record<string, string | undefined>, scope: "all" | "mine") {
  try {
    await db.export.update({ where: { id: exportId }, data: { status: "processing" } });
    const access = await getFormAccess(formId, userId);
    if (!access) throw new Error("FORBIDDEN");
    const user = await db.user.findUnique({ where: { id: userId } });

    // Mêmes filtres que la requête initiale
    const from = safeLocalDate(filters.from);
    const to = safeLocalDate(filters.to);
    const where: Record<string, unknown> = { formId, deletedAt: null };
    if (scope === "mine" && access.membership) where.memberId = access.membership.id;
    else if (filters.member_id) where.memberId = filters.member_id;
    if (from || to) {
      where.submittedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: new Date(to.getTime() + 86_399_000) } : {}),
      };
    }
    if (filters.status && LEAD_STATUSES.includes(filters.status)) where.leadStatus = filters.status;
    const submissions = await db.submission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: { member: { include: { user: true } }, link: true },
    });

    const { payload, rowCount } = await buildPayload(access, filters, scope, submissions);
    payload.meta.generatedBy = user ? `${user.firstName} ${user.lastName}` : "";

    let buffer: Buffer;
    let ext: string;
    if (format === "pdf") { buffer = buildPdf(payload); ext = "pdf"; }
    else if (format === "csv") { buffer = buildCsv(payload); ext = "csv"; }
    else { buffer = await buildXlsx(payload); ext = "xlsx"; }

    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const filePath = path.join(EXPORT_DIR, `export-${exportId}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    await db.export.update({
      where: { id: exportId },
      data: { status: "ready", filePath, rowCount, expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
    await db.notification.create({
      data: {
        userId,
        type: "export_ready",
        payload: JSON.stringify({ exportId, rowCount, format }),
      },
    });
  } catch (err) {
    try {
      await db.export.update({
        where: { id: exportId },
        data: { status: "failed", error: String(err).slice(0, 500) },
      });
    } catch { /* la mise à jour du statut ne doit pas masquer l'erreur d'origine */ }
  }
}
