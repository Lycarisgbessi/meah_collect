import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, audit } from "@/lib/api-utils";

// GET /api/admin — vue d'ensemble back-office (Module H)
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (r.user.role !== "admin") return jsonError("FORBIDDEN", "Accès réservé aux administrateurs.", 403);

  const [users, forms, totalUsers, totalForms, submissions, suspendedUsers, openReports] = await Promise.all([
    db.user.findMany({ where: { email: { not: { endsWith: "anonyme.local" } } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, firstName: true, lastName: true, email: true, isSuspended: true, role: true, createdAt: true } }),
    db.form.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { owner: { select: { firstName: true, lastName: true } }, _count: { select: { submissions: true, members: true } } } }),
    db.user.count({ where: { email: { not: { endsWith: "anonyme.local" } } } }),
    db.form.count(),
    db.submission.count({ where: { deletedAt: null } }),
    db.user.count({ where: { isSuspended: true } }),
    db.abuseReport.findMany({ where: { status: "open" }, include: { form: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return jsonOk({
    stats: { users: totalUsers, forms: totalForms, submissions, suspendedUsers },
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    forms: forms.map((f) => ({
      id: f.id, title: f.title, status: f.status, ownerName: `${f.owner.firstName} ${f.owner.lastName}`,
      submissionsCount: f._count.submissions, membersCount: f._count.members, updatedAt: f.updatedAt.toISOString(),
    })),
    reports: openReports.map((rp) => ({ id: rp.id, reason: rp.reason, formTitle: rp.form?.title ?? "", createdAt: rp.createdAt.toISOString() })),
  });
}

// POST /api/admin — suspension / réactivation / résolution de signalement (Module H)
export async function POST(req: NextRequest) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (r.user.role !== "admin") return jsonError("FORBIDDEN", "Accès réservé aux administrateurs.", 403);

  let body: { action?: string; userId?: string; formId?: string; reportId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Requête invalide.", 400);
  }

  if (body.action === "suspend_user" && body.userId) {
    if (body.userId === r.user.id) return jsonError("FORBIDDEN", "Impossible de se suspendre soi-même.", 403);
    const target = await db.user.findUnique({ where: { id: body.userId } });
    if (!target) return jsonError("NOT_FOUND", "Utilisateur introuvable.", 404);
    if (target.role === "admin") return jsonError("FORBIDDEN", "Un autre administrateur ne peut pas être suspendu.", 403);
    await db.user.update({ where: { id: target.id }, data: { isSuspended: true } });
    await audit(r.user.id, "admin.user_suspended", "user", target.id);
    return jsonOk({ ok: true });
  }
  if (body.action === "reactivate_user" && body.userId) {
    const target = await db.user.findUnique({ where: { id: body.userId } });
    if (!target) return jsonError("NOT_FOUND", "Utilisateur introuvable.", 404);
    await db.user.update({ where: { id: target.id }, data: { isSuspended: false } });
    await audit(r.user.id, "admin.user_reactivated", "user", target.id);
    return jsonOk({ ok: true });
  }
  if (body.action === "suspend_form" && body.formId) {
    const target = await db.form.findUnique({ where: { id: body.formId } });
    if (!target) return jsonError("NOT_FOUND", "Formulaire introuvable.", 404);
    await db.form.update({ where: { id: target.id }, data: { status: "closed" } });
    await audit(r.user.id, "admin.form_suspended", "form", target.id);
    return jsonOk({ ok: true });
  }
  if (body.action === "resolve_report" && (body.reportId || body.formId)) {
    await db.abuseReport.updateMany({
      where: body.reportId ? { id: body.reportId, status: "open" } : { formId: body.formId!, status: "open" },
      data: { status: "resolved" },
    });
    return jsonOk({ ok: true });
  }
  return jsonError("VALIDATION_FAILED", "Action inconnue.", 400);
}
