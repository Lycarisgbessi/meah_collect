import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonOk, jsonError, requireUser, safeParse } from "@/lib/api-utils";

// GET /api/notifications — cloche in-app (Annexe G)
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const user = r.user;

  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return jsonOk({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      payload: safeParse<Record<string, unknown>>(n.payload, {}),
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

// POST /api/notifications — tout marquer comme lu
export async function POST() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  await db.notification.updateMany({
    where: { userId: r.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return jsonOk({ ok: true });
}
