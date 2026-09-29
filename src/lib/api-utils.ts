// ============================================================
// Utilitaires serveur — réponses API normalisées (Annexe D),
// rate limiting (Annexe D.4), audit, résolution d'utilisateur.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "./db";
import { verifySession, hashIp, signSession, sessionPv } from "./crypto";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "meah_collect_session";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(code: string, message: string, status: number, fields?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, fields } }, { status });
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.uid } });
  if (!user || user.isSuspended) return null;
  // Révocabilité : une session issue d'un ancien mot de passe est refusée.
  if (payload.pv !== sessionPv(user.passwordHash)) return null;
  return user;
}

export async function requireUser(): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("AUTH_REQUIRED", "Veuillez vous connecter.", 401) };
  return { user };
}

export function sessionResponse(uid: string, pwdHash: string, body?: Record<string, unknown>, status = 200): NextResponse {
  const token = signSession(uid, pwdHash);
  const res = NextResponse.json(body ?? { ok: true }, { status });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 86400,
    path: "/",
  });
  return res;
}

export function clearSessionCookie(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export function ipHashOf(req: NextRequest): string {
  return hashIp(getClientIp(req));
}

// ---------- Rate limiting mémoire (Annexe D.4) ----------
const buckets = new Map<string, number[]>();

function sweep(now: number, windowMs: number) {
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
}

/** Vérifie la limite sans consommer de quota (retourne false si dépassé) */
export function rateLimitPeek(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, arr);
  sweep(now, windowMs);
  return arr.length < limit;
}

/** Enregistre une occurrence (à appeler uniquement en cas d'échec) */
export function rateLimitRecord(key: string): void {
  const now = Date.now();
  const arr = buckets.get(key) ?? [];
  arr.push(now);
  buckets.set(key, arr);
}

/** Vérifie ET enregistre une occurrence (quota par requête) */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (!rateLimitPeek(key, limit, windowMs)) return false;
  rateLimitRecord(key);
  return true;
}

// ---------- Audit (journal des actions sensibles) ----------
export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, metadata?: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId, metadata: JSON.stringify(metadata ?? {}) },
    });
  } catch {
    // l'audit ne doit jamais bloquer une opération métier
  }
}

// ---------- Helpers ----------
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function sanitizeText(v: unknown, maxLen = 500): string {
  if (typeof v !== "string") return "";
  // Neutralise HTML/caractères de contrôle (Annexe E : échappement systématique)
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLen);
}

export function normalizeEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "";
}

/** Préfixe anti-injection formule pour les exports (§9.3) */
export function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// ---------- Parsing sécurisé des paramètres de requête (jamais de NaN / Invalid Date) ----------
export function safeInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Date locale « YYYY-MM-DD » → Date UTC valide, sinon null. */
export function safeLocalDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO datetime valide, sinon null. */
export function safeIsoDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z)?)?$/.test(raw)) return null;
  const d = new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** URL publique sûre (http/https uniquement) — bloque javascript:, data:, etc. */
export function sanitizeUrl(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const v = raw.trim().slice(0, maxLen);
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return v;
  } catch {
    return null;
  }
}
