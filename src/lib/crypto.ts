// ============================================================
// Cryptographie — Annexe C (gen_slug, tokens CSPRNG) + sécurité §9.3
// Mots de passe : scrypt (N=16384) avec sel aléatoire.
// Sessions : token HMAC-SHA256 signé, cookie httpOnly,
//            lié à une version du mot de passe (révocabilité).
// ============================================================

import crypto from "crypto";

// ---------- Secrets (aucun repli exploitable en production) ----------
const DEV_SECRET = "meah-collect-dev-secret-change-me-in-production-9f2c";
const DEV_IP_SALT = "meah-collect-ip-salt-2026-dev";

/**
 * Secret résolu À LA DEMANDE (jamais à l'import) : le build de Next.js évalue
 * les modules des routes API sans variables d'environnement — la vérification
 * stricte ne doit s'exécuter qu'au traitement réel d'une requête (runtime).
 */
const secretCache = new Map<string, string>();
function requiredSecret(name: string, devValue: string): string {
  const cached = secretCache.get(name);
  if (cached) return cached;
  const v = process.env[name];
  if (v && v.length >= 16) {
    secretCache.set(name, v);
    return v;
  }
  // Skip des étapes de build (collecte de données de page, instrumentation) :
  // aucun secret n'y est utilisé, tout doit pouvoir s'importer sans planter.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return devValue;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[config] ${name} est manquant ou trop court (≥ 16 caractères) — configuration serveur invalide.`);
  }
  if (!v) console.warn(`[config] ${name} absent — valeur de DÉVELOPPEMENT utilisée (interdit en production).`);
  secretCache.set(name, devValue);
  return devValue;
}

function authSecret(): string {
  return requiredSecret("AUTH_SECRET", DEV_SECRET);
}

// ---------- Mots de passe (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `s2$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "s2" || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/** Hachage factice pour égaliser le temps de réponse quand le compte n'existe pas (anti-énumération par timing). */
const DUMMY_HASH = hashPassword("timing-equalizer-" + crypto.randomBytes(8).toString("hex"));
export function burnPasswordTiming(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}

export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

// ---------- Comparaisons timing-safe ----------
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Générateurs CSPRNG (RM-03 : non devinables) ----------
const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Slug de lien dérivé : 10 caractères aléatoires (ex. k8Xq2mPzTa) */
export function genSlug(len = 10): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

/** Token d'invitation ≥ 128 bits (32 caractères base64url) */
export function genToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Code de vérification e-mail à 6 chiffres — CSPRNG (jamais Math.random). */
export function genCode6(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// ---------- Sessions HMAC ----------
export interface SessionPayload {
  uid: string;
  exp: number; // epoch secondes
  /** Version du mot de passe : change à chaque modification → invalide les sessions volées. */
  pv: string;
}

/** Empreinte courte du hash de mot de passe (version de session). */
export function sessionPv(passwordHash: string): string {
  return crypto.createHmac("sha256", authSecret()).update(`pv:${passwordHash}`).digest("hex").slice(0, 16);
}

export function signSession(uid: string, pwdHash: string, ttlDays = 30): string {
  const payload: SessionPayload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
    pv: sessionPv(pwdHash),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.uid || !payload.pv || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Hachage IP (RGPD : jamais d'IP en clair) ----------
export function hashIp(ip: string): string {
  return crypto.createHmac("sha256", requiredSecret("IP_SALT", DEV_IP_SALT)).update(ip).digest("hex").slice(0, 32);
}
