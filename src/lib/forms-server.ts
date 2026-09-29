// ============================================================
// Helpers serveur formulaires — permissions par formulaire (Annexe A)
// ============================================================

import { db } from "./db";
import type { Form, FormMember, FormVersion, FormField, User } from "@prisma/client";
import { safeParse } from "./api-utils";
import { FIELD_CATALOG } from "./fields";
import type { FormFieldDef, FormSettings, FormTheme, FieldType } from "./types";

/** Types de champs autorisés (catalogue Q.3). */
export const VALID_FIELD_TYPES = new Set<string>(Object.keys(FIELD_CATALOG));

export function isValidFieldType(t: string): t is FieldType {
  return VALID_FIELD_TYPES.has(t);
}

// ---------- Normalisation whitelistée de theme/settings (PATCH form) ----------
const THEME_KEYS = ["accent", "logoUrl", "bannerUrl"] as const;

export function sanitizeTheme(raw: unknown, previous: FormTheme): FormTheme {
  if (typeof raw !== "object" || raw === null) return previous;
  const out: FormTheme = { ...previous };
  const src = raw as Record<string, unknown>;
  for (const k of THEME_KEYS) {
    if (k in src) {
      const v = src[k];
      out[k] = typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.slice(0, 500) : undefined;
    }
  }
  return out;
}

function asIntOrNull(v: unknown): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function sanitizeSettings(raw: unknown, previous: FormSettings): FormSettings {
  if (typeof raw !== "object" || raw === null) return previous;
  const src = raw as Record<string, unknown>;
  const out: FormSettings = { ...previous };

  if ("finalMessage" in src) out.finalMessage = typeof src.finalMessage === "string" ? src.finalMessage.slice(0, 1000) : undefined;
  if ("redirectUrl" in src) out.redirectUrl = typeof src.redirectUrl === "string" ? src.redirectUrl.slice(0, 500) : undefined;
  if ("introText" in src) out.introText = typeof src.introText === "string" ? src.introText.slice(0, 2000) : undefined;
  if ("closesAt" in src) {
    if (src.closesAt === null || src.closesAt === "") out.closesAt = null;
    else if (typeof src.closesAt === "string") {
      const d = new Date(src.closesAt);
      out.closesAt = Number.isNaN(d.getTime()) ? previous.closesAt ?? null : d.toISOString();
    }
  }
  if ("maxSubmissions" in src) out.maxSubmissions = asIntOrNull(src.maxSubmissions);
  if ("consentText" in src) out.consentText = typeof src.consentText === "string" ? src.consentText.slice(0, 2000) : undefined;
  if ("showBranding" in src) out.showBranding = src.showBranding === true;
  if ("allowAnother" in src) out.allowAnother = src.allowAnother === true;
  if ("estimateMinutes" in src) out.estimateMinutes = asIntOrNull(src.estimateMinutes) ?? undefined;
  if ("notifyOwner" in src) out.notifyOwner = src.notifyOwner !== false;
  if ("notifyMember" in src) out.notifyMember = src.notifyMember !== false;
  if ("dedup" in src) {
    const d = src.dedup;
    if (typeof d === "object" && d !== null) {
      const dd = d as Record<string, unknown>;
      const keys = Array.isArray(dd.keys) ? dd.keys.filter((k): k is "email" | "phone" => k === "email" || k === "phone") : [];
      out.dedup = {
        enabled: dd.enabled === true,
        keys,
        mode: dd.mode === "warn" ? "warn" : "block",
      };
    } else {
      out.dedup = undefined;
    }
  }
  return out;
}

export interface FormAccess {
  form: Form;
  role: "owner" | "member" | null;
  membership: FormMember | null;
}

/** Les droits s'évaluent par formulaire, jamais globalement (Annexe A, règles complémentaires). */
export async function getFormAccess(formId: string, userId: string): Promise<FormAccess | null> {
  const form = await db.form.findUnique({ where: { id: formId } });
  if (!form) return null;
  if (form.ownerId === userId) return { form, role: "owner", membership: null };
  const membership = await db.formMember.findUnique({
    where: { formId_userId: { formId, userId } },
  });
  if (!membership || membership.status === "removed") return null;
  return { form, role: "member", membership };
}

export function fieldsOfVersion(v: (FormVersion & { fields: FormField[] }) | null): FormFieldDef[] {
  if (!v) return [];
  return [...v.fields]
    .sort((a, b) => a.position - b.position)
    .map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type as FormFieldDef["type"],
      isRequired: f.isRequired,
      position: f.position,
      options: safeParse(f.options, {}),
    }));
}

export function themeOf(form: Form): FormTheme {
  return safeParse<FormTheme>(form.theme, {});
}

export function settingsOf(form: Form): FormSettings {
  return safeParse<FormSettings>(form.settings, {});
}

export async function getFormWithCurrentVersion(formId: string) {
  const form = await db.form.findUnique({
    where: { id: formId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { fields: true } } },
  });
  return form;
}

/** Version PUBLIÉE la plus récente — c'est elle que le public doit voir (RM-07).
 *  Repli sur la version courante uniquement si aucune version publiée n'existe
 *  (formulaires publiés avant la mise en place du versionnage). */
export async function getPublishedVersion(formId: string) {
  const published = await db.formVersion.findFirst({
    where: { formId, isPublished: true },
    orderBy: { versionNumber: "desc" },
    include: { fields: true },
  });
  if (published) return published;
  return db.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: "desc" },
    include: { fields: true },
  });
}

/** Sauvegarde de structure avec versionnage (RM-07) :
 *  - brouillon → édition de la version courante
 *  - publié → création d'une NOUVELLE version (les anciennes réponses restent liées)
 *  Transactionnelle : un échec laisse la version précédente intacte. */
export async function saveStructure(form: Form, fields: FormFieldDef[]) {
  const current = await db.formVersion.findFirst({
    where: { formId: form.id },
    orderBy: { versionNumber: "desc" },
  });
  const dirty = form.status === "published" && current?.isPublished;

  return db.$transaction(async (tx) => {
    let version = current;
    if (dirty || !current) {
      version = await tx.formVersion.create({
        data: { formId: form.id, versionNumber: (current?.versionNumber ?? 0) + 1, isPublished: false },
      });
      await tx.form.update({ where: { id: form.id }, data: { currentVersionId: version.id } });
    }

    await tx.formField.deleteMany({ where: { versionId: version!.id } });
    const seen = new Set<string>();
    let pos = 0;
    for (const f of fields.slice(0, 100)) {
      let key = (f.key || "").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 50);
      if (!key || seen.has(key)) key = `${key || "champ"}_${pos}_${Date.now().toString(36).slice(-4)}`;
      seen.add(key);
      await tx.formField.create({
        data: {
          versionId: version!.id,
          key,
          label: (f.label || "Question").slice(0, 200),
          type: f.type,
          isRequired: !!f.isRequired,
          position: pos,
          options: JSON.stringify(f.options ?? {}),
        },
      });
      pos++;
    }
    return { versionId: version!.id, newVersion: !!dirty };
  });
}

/** Vérification qualité avant publication (Q-12 / F.4 modale de contrôle) */
export function publicationChecklist(fields: FormFieldDef[]): { ok: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  const questions = fields.filter((f) => f.type !== "section_title" && f.type !== "paragraph_text" && f.type !== "divider" && f.type !== "image_block" && f.type !== "callout" && f.type !== "page_break" && f.type !== "welcome_screen" && f.type !== "end_screen");
  if (questions.length === 0) issues.push("Ajoutez au moins une question.");
  if (fields.some((f) => !f.label?.trim())) issues.push("Certaines questions n'ont pas de libellé.");
  const contactTypes = ["email", "phone", "first_name", "last_name", "full_name"];
  if (!questions.some((q) => contactTypes.includes(q.type))) warnings.push("Aucun champ de contact (nom, e-mail, téléphone) — vos répondants seront difficiles à recontacter.");
  if (!questions.some((q) => q.type === "consent")) warnings.push("Aucun champ de consentement — recommandé pour la conformité RGPD.");
  if (questions.length > 15) warnings.push("Formulaire long : envisagez des sections pour faciliter le remplissage.");
  return { ok: issues.length === 0, issues, warnings };
}

export function displayName(u: Pick<User, "firstName" | "lastName">): string {
  return `${u.firstName} ${u.lastName}`.trim();
}
