import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser } from "@/lib/api-utils";
import { getFormAccess } from "@/lib/forms-server";
import type { StatsDTO } from "@/lib/types";

interface Ctx { params: Promise<{ id: string }> }

// GET /api/forms/:id/stats — F-04, F-05, F-10 (KPI + évolution + performance par membre)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const access = await getFormAccess(id, r.user.id);
  if (!access) return jsonError("FORBIDDEN", "Vous n'avez pas accès à cette ressource.", 403);

  const scope = access.role === "owner" ? "all" : "mine";
  const base = { formId: id, deletedAt: null, ...(scope === "mine" ? { memberId: access.membership!.id } : {}) };

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const d30 = new Date(Date.now() - 30 * 86400_000);

  const [total, today, last7, last30] = await Promise.all([
    db.submission.count({ where: base }),
    db.submission.count({ where: { ...base, submittedAt: { gte: startOfDay } } }),
    db.submission.count({ where: { ...base, submittedAt: { gte: d7 } } }),
    db.submission.count({ where: { ...base, submittedAt: { gte: d30 } } }),
  ]);

  // Évolution sur 30 jours (groupée par jour)
  const since = new Date(d30);
  const subs = await db.submission.findMany({
    where: { ...base, submittedAt: { gte: since } },
    select: { submittedAt: true },
    orderBy: { submittedAt: "asc" },
  });
  const byDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(d30.getTime() + i * 86400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of subs) {
    const key = s.submittedAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const evolution = [...byDay.entries()].map(([date, count]) => ({ date, count }));

  let byMember: StatsDTO["byMember"] = [];
  if (scope === "all") {
    const groups = await db.submission.groupBy({
      by: ["memberId"],
      where: base,
      _count: true,
    });
    const members = await db.formMember.findMany({
      where: { formId: id, status: { not: "removed" } },
      include: { user: true },
    });
    const counts = new Map(groups.map((g) => [g.memberId, g._count]));
    byMember = members
      .map((m) => ({ memberId: m.id, name: `${m.user.firstName} ${m.user.lastName}`, count: counts.get(m.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const statusGroups = await db.submission.groupBy({ by: ["leadStatus"], where: base, _count: true });
  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.leadStatus] = g._count;

  const stats: StatsDTO = { total, today, last7, last30, evolution, byMember, byStatus };
  return jsonOk(stats);
}
