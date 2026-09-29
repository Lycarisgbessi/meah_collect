// ============================================================
// Catalogue des types de champs — Annexe Q.3 (périmètre 🟢 v1)
// Source unique pour le constructeur, l'aperçu, le rendu public
// et la validation serveur (Annexe E + Q.6).
// ============================================================

import type { FieldOptions, FieldType, FormFieldDef, ChoiceOption } from "./types";

export type FieldFamily =
  | "identity" // Texte et identité
  | "choice" // Choix (QCM, oui/non, listes)
  | "scale" // Échelles et évaluation
  | "number_date" // Nombres, dates
  | "content"; // Blocs de contenu (non-questions)

export interface CatalogEntry {
  code: FieldType;
  label: string;
  family: FieldFamily;
  icon: string; // nom d'icône lucide-react
  description: string;
  isQuestion: boolean;
  hasChoices?: boolean;
  defaultRequired?: boolean;
  defaultOptions?: FieldOptions;
}

export const FAMILY_LABELS: Record<FieldFamily, string> = {
  identity: "Texte et identité",
  choice: "Choix",
  scale: "Échelles et évaluation",
  number_date: "Nombres, dates",
  content: "Blocs de contenu",
};

export const FIELD_CATALOG: Record<FieldType, CatalogEntry> = {
  // ---- Famille 1 : Texte et identité ----
  short_text: { code: "short_text", label: "Réponse courte", family: "identity", icon: "Type", description: "Une ligne de texte", isQuestion: true, defaultOptions: { maxLength: 500 } },
  long_text: { code: "long_text", label: "Réponse longue", family: "identity", icon: "AlignLeft", description: "Zone multiligne", isQuestion: true, defaultOptions: { maxLength: 5000 } },
  first_name: { code: "first_name", label: "Prénom", family: "identity", icon: "User", description: "Préconfiguré, capitalisation auto", isQuestion: true },
  last_name: { code: "last_name", label: "Nom de famille", family: "identity", icon: "User", description: "Préconfiguré", isQuestion: true },
  full_name: { code: "full_name", label: "Nom complet", family: "identity", icon: "IdCard", description: "Prénom + nom sur un champ", isQuestion: true },
  email: { code: "email", label: "Adresse e-mail", family: "identity", icon: "Mail", description: "Validation du format e-mail", isQuestion: true },
  phone: { code: "phone", label: "Téléphone", family: "identity", icon: "Phone", description: "Indicatif pays, format E.164", isQuestion: true, defaultOptions: { defaultCountry: "FR" } },
  url: { code: "url", label: "Site web / lien", family: "identity", icon: "Link2", description: "Validation d'URL", isQuestion: true },
  company: { code: "company", label: "Entreprise", family: "identity", icon: "Building2", description: "Organisation / société", isQuestion: true },
  job_title: { code: "job_title", label: "Fonction", family: "identity", icon: "Briefcase", description: "Profession / poste", isQuestion: true },
  city: { code: "city", label: "Ville", family: "identity", icon: "MapPin", description: "Texte court ville", isQuestion: true },
  country: { code: "country", label: "Pays", family: "identity", icon: "Globe2", description: "Liste ISO avec recherche", isQuestion: true },
  hidden: { code: "hidden", label: "Champ caché", family: "identity", icon: "EyeOff", description: "Non affiché, enregistré (source, campagnes)", isQuestion: true },

  // ---- Famille 2 : Choix ----
  single_choice: { code: "single_choice", label: "Choix unique", family: "choice", icon: "CircleDot", description: "Boutons radio, une réponse", isQuestion: true, hasChoices: true, defaultOptions: { layout: "vertical", choices: [{ value: "a", label: "Option 1" }, { value: "b", label: "Option 2" }] } },
  multiple_choice: { code: "multiple_choice", label: "Choix multiple", family: "choice", icon: "ListChecks", description: "Cases à cocher, plusieurs réponses", isQuestion: true, hasChoices: true, defaultOptions: { layout: "vertical", choices: [{ value: "a", label: "Option 1" }, { value: "b", label: "Option 2" }, { value: "c", label: "Option 3" }] } },
  dropdown: { code: "dropdown", label: "Liste déroulante", family: "choice", icon: "ChevronDown", description: "Une réponse dans une liste, recherche intégrée", isQuestion: true, hasChoices: true, defaultOptions: { choices: [{ value: "a", label: "Option 1" }, { value: "b", label: "Option 2" }] } },
  yes_no: { code: "yes_no", label: "Oui / Non", family: "choice", icon: "ToggleLeft", description: "Deux boutons, libellés modifiables", isQuestion: true, defaultOptions: { choices: [{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }] } },
  yes_no_unknown: { code: "yes_no_unknown", label: "Oui / Non / Je ne sais pas", family: "choice", icon: "CircleHelp", description: "Trois choix avec réponse neutre", isQuestion: true, defaultOptions: { choices: [{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }, { value: "unknown", label: "Je ne sais pas" }] } },
  true_false: { code: "true_false", label: "Vrai / Faux", family: "choice", icon: "Check", description: "Idéal pour les quiz", isQuestion: true, defaultOptions: { choices: [{ value: "true", label: "Vrai" }, { value: "false", label: "Faux" }] } },
  true_false_unknown: { code: "true_false_unknown", label: "Vrai / Faux / Je ne sais pas", family: "choice", icon: "Check", description: "Avec réponse neutre", isQuestion: true, defaultOptions: { choices: [{ value: "true", label: "Vrai" }, { value: "false", label: "Faux" }, { value: "unknown", label: "Je ne sais pas" }] } },
  consent: { code: "consent", label: "Consentement", family: "choice", icon: "ShieldCheck", description: "Case obligatoire avec texte légal (RGPD)", isQuestion: true, defaultRequired: true, defaultOptions: { consentText: "J'accepte que mes informations soient utilisées dans le cadre de cette collecte." } },

  // ---- Famille 3 : Échelles ----
  rating_stars: { code: "rating_stars", label: "Notation par étoiles", family: "scale", icon: "Star", description: "3 à 10 étoiles, icône au choix", isQuestion: true, defaultOptions: { maxValue: 5 } },
  number_scale: { code: "number_scale", label: "Échelle numérique", family: "scale", icon: "Hash", description: "De 0 à 5/7/10, extrémités personnalisables", isQuestion: true, defaultOptions: { min: 0, max: 10, labels: { left: "Pas du tout", right: "Tout à fait" } } },
  nps: { code: "nps", label: "Net Promoter Score", family: "scale", icon: "Gauge", description: "Échelle 0–10 « Recommanderiez-vous… ? »", isQuestion: true, defaultOptions: { min: 0, max: 10, labels: { left: "Pas du tout probable", right: "Très probable" } } },
  likert: { code: "likert", label: "Échelle de Likert", family: "scale", icon: "Smile", description: "3, 5 ou 7 niveaux d'accord", isQuestion: true, defaultOptions: { levels: 5 } },

  // ---- Famille 4 : Nombres et dates ----
  integer: { code: "integer", label: "Nombre entier", family: "number_date", icon: "Hash", description: "Min / max, séparateur de milliers", isQuestion: true },
  decimal: { code: "decimal", label: "Montant / décimal", family: "number_date", icon: "Banknote", description: "Décimales, devise", isQuestion: true, defaultOptions: { currency: "EUR" } },
  date: { code: "date", label: "Date", family: "number_date", icon: "CalendarDays", description: "Sélecteur de calendrier", isQuestion: true },
  birthdate: { code: "birthdate", label: "Date de naissance", family: "number_date", icon: "Cake", description: "Jour / mois / année facilité", isQuestion: true },
  time: { code: "time", label: "Heure", family: "number_date", icon: "Clock", description: "Format 24 h", isQuestion: true },

  // ---- Famille 7 : Blocs de contenu ----
  section_title: { code: "section_title", label: "Titre de section", family: "content", icon: "Heading2", description: "Titre + sous-titre pour structurer", isQuestion: false, defaultOptions: { content: "" } },
  paragraph_text: { code: "paragraph_text", label: "Texte explicatif", family: "content", icon: "Paragraph", description: "Paragraphe mis en forme", isQuestion: false, defaultOptions: { content: "" } },
  image_block: { code: "image_block", label: "Image", family: "content", icon: "ImageIcon", description: "Illustration, logo, schéma", isQuestion: false, defaultOptions: { imageUrl: "" } },
  callout: { code: "callout", label: "Encadré d'information", family: "content", icon: "Info", description: "Message mis en avant / avertissement", isQuestion: false, defaultOptions: { content: "" } },
  divider: { code: "divider", label: "Séparateur", family: "content", icon: "Minus", description: "Trait ou espace vertical", isQuestion: false },
  page_break: { code: "page_break", label: "Saut de page", family: "content", icon: "Scissors", description: "Crée une nouvelle étape", isQuestion: false },
  welcome_screen: { code: "welcome_screen", label: "Écran d'accueil", family: "content", icon: "DoorOpen", description: "Titre, description, bouton « Commencer »", isQuestion: false, defaultOptions: { content: "" } },
  end_screen: { code: "end_screen", label: "Écran de fin", family: "content", icon: "Flag", description: "Message de remerciement personnalisé", isQuestion: false, defaultOptions: { content: "" } },
};

export const QUESTION_TYPES = Object.values(FIELD_CATALOG).filter((e) => e.isQuestion).map((e) => e.code);
export const CONTENT_TYPES = Object.values(FIELD_CATALOG).filter((e) => !e.isQuestion).map((e) => e.code);

const KEY_STOPWORDS = new Set(["le", "la", "les", "de", "des", "du", "et", "ou", "à", "au", "aux", "d", "l", "un", "une", "votre", "vos"]);

/** Génère une clé technique stable depuis le type + un compteur (Annexe Q.2) */
export function generateFieldKey(type: string, existingKeys: string[]): string {
  const base = type.replace(/_/g, "_");
  let i = 1;
  let key = `${base}_${i}`;
  while (existingKeys.includes(key)) {
    i += 1;
    key = `${base}_${i}`;
  }
  return key;
}

export function createDefaultField(type: FieldType, position: number, existingKeys: string[]): FormFieldDef {
  const entry = FIELD_CATALOG[type];
  const key = generateFieldKey(type, existingKeys);
  const defaultLabels: Partial<Record<FieldType, string>> = {
    short_text: "Votre réponse",
    long_text: "Décrivez en détail",
    email: "Votre adresse e-mail",
    phone: "Votre numéro de téléphone",
    first_name: "Votre prénom",
    last_name: "Votre nom",
    full_name: "Votre nom complet",
    company: "Votre entreprise",
    job_title: "Votre fonction",
    city: "Votre ville",
    country: "Votre pays",
    url: "Votre site web",
    integer: "Un nombre",
    decimal: "Un montant",
    date: "Choisissez une date",
    birthdate: "Votre date de naissance",
    time: "Choisissez une heure",
    consent: "Consentement",
    section_title: "Nouvelle section",
    paragraph_text: "Texte explicatif…",
    callout: "Information importante",
    welcome_screen: "Bienvenue",
    end_screen: "Merci !",
  };
  return {
    key,
    label: defaultLabels[type] ?? entry.label,
    type,
    isRequired: entry.defaultRequired ?? false,
    position,
    options: JSON.parse(JSON.stringify(entry.defaultOptions ?? {})),
  };
}

// ============================================================
// LIBELLÉS LIKERT
// ============================================================
export const LIKERT_LABELS: Record<number, string[]> = {
  3: ["Pas d'accord", "Neutre", "D'accord"],
  5: ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"],
  7: ["Pas du tout d'accord", "Pas d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "D'accord", "Tout à fait d'accord"],
};

// ============================================================
// PAYS (sous-ensemble local — code ISO 3166-1 alpha-2)
// ============================================================
export const COUNTRIES: { code: string; name: string; dial?: string }[] = [
  { code: "FR", name: "France", dial: "+33" },
  { code: "BE", name: "Belgique", dial: "+32" },
  { code: "CH", name: "Suisse", dial: "+41" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GN", name: "Guinée", dial: "+224" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225" },
  { code: "SN", name: "Sénégal", dial: "+221" },
  { code: "ML", name: "Mali", dial: "+223" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "CM", name: "Cameroun", dial: "+237" },
  { code: "GA", name: "Gabon", dial: "+241" },
  { code: "CD", name: "RD Congo", dial: "+243" },
  { code: "MA", name: "Maroc", dial: "+212" },
  { code: "DZ", name: "Algérie", dial: "+213" },
  { code: "TN", name: "Tunisie", dial: "+216" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MC", name: "Monaco", dial: "+377" },
  { code: "US", name: "États-Unis", dial: "+1" },
  { code: "GB", name: "Royaume-Uni", dial: "+44" },
  { code: "DE", name: "Allemagne", dial: "+49" },
  { code: "ES", name: "Espagne", dial: "+34" },
  { code: "IT", name: "Italie", dial: "+39" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "NL", name: "Pays-Bas", dial: "+31" },
];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// ============================================================
// BIBLIOTHÈQUE DE JEUX DE RÉPONSES (Annexe Q.4)
// ============================================================
export const ANSWER_SETS: { category: string; name: string; choices: ChoiceOption[] }[] = [
  { category: "Oui / Non", name: "Oui / Non", choices: [{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }] },
  { category: "Oui / Non", name: "Oui / Non / Je ne sais pas", choices: [{ value: "yes", label: "Oui" }, { value: "no", label: "Non" }, { value: "unknown", label: "Je ne sais pas" }] },
  { category: "Accord (Likert)", name: "Likert 5 niveaux", choices: LIKERT_LABELS[5].map((l, i) => ({ value: String(i + 1), label: l })) },
  { category: "Satisfaction", name: "Très insatisfait → Très satisfait", choices: [{ value: "1", label: "Très insatisfait" }, { value: "2", label: "Insatisfait" }, { value: "3", label: "Neutre" }, { value: "4", label: "Satisfait" }, { value: "5", label: "Très satisfait" }] },
  { category: "Fréquence", name: "Jamais → Toujours", choices: [{ value: "1", label: "Jamais" }, { value: "2", label: "Rarement" }, { value: "3", label: "Parfois" }, { value: "4", label: "Souvent" }, { value: "5", label: "Toujours" }] },
  { category: "Importance", name: "Pas important → Extrêmement important", choices: [{ value: "1", label: "Pas important" }, { value: "2", label: "Peu important" }, { value: "3", label: "Important" }, { value: "4", label: "Très important" }, { value: "5", label: "Extrêmement important" }] },
  { category: "Civilité", name: "Civilité", choices: [{ value: "m", label: "M." }, { value: "mme", label: "Mme" }, { value: "autre", label: "Autre" }] },
  { category: "Profil", name: "Tranches d'âge", choices: [{ value: "18-24", label: "18 – 24 ans" }, { value: "25-34", label: "25 – 34 ans" }, { value: "35-44", label: "35 – 44 ans" }, { value: "45-54", label: "45 – 54 ans" }, { value: "55+", label: "55 ans et plus" }] },
  { category: "Profil", name: "Niveau d'études", choices: [{ value: "bac", label: "Baccalauréat" }, { value: "bac+2", label: "Bac +2" }, { value: "bac+3", label: "Licence / Bac +3" }, { value: "bac+5", label: "Master / Bac +5" }, { value: "doctorat", label: "Doctorat" }] },
  { category: "Autres", name: "Canal de connaissance", choices: [{ value: "reseau", label: "Bouche à oreille" }, { value: "reseaux_sociaux", label: "Réseaux sociaux" }, { value: "recherche", label: "Moteur de recherche" }, { value: "publicite", label: "Publicité" }, { value: "autre", label: "Autre" }] },
  { category: "Autres", name: "Moyens de contact préférés", choices: [{ value: "tel", label: "Téléphone" }, { value: "email", label: "E-mail" }, { value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }] },
];

// ============================================================
// NORMALISATION + VALIDATION (Annexe E — partagée client/serveur)
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/i;

export function normalizePhone(raw: string, defaultCountry = "FR"): string {
  const dial = COUNTRIES.find((c) => c.code === defaultCountry)?.dial ?? "+33";
  let v = (raw || "").trim();
  if (v.startsWith("00")) v = "+" + v.slice(2);
  if (!v.startsWith("+")) v = dial + v.replace(/^0+/, "");
  return "+" + v.slice(1).replace(/[^\d]/g, "") ? v.replace(/[^\d+]/g, "") : v;
}

export type AnswerValue = string | number | boolean | string[] | null | undefined;

/** Valide une réponse. Retourne null si OK, sinon un message d'erreur humain (Annexe H). */
export function validateAnswer(field: FormFieldDef, value: AnswerValue): string | null {
  const required = field.isRequired;
  const empty =
    value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (field.type === "consent") {
    if (required && value !== true) return "Votre consentement est nécessaire pour continuer.";
    return null;
  }
  if (required && empty) return "Ce champ est nécessaire pour continuer.";
  if (empty) return null;

  switch (field.type) {
    case "email": {
      const v = String(value).trim();
      if (!EMAIL_RE.test(v)) return "Cette adresse semble incorrecte. Exemple : nom@domaine.com";
      if (v.length > 254) return "Cette adresse est trop longue.";
      return null;
    }
    case "phone": {
      const v = normalizePhone(String(value), field.options.defaultCountry ?? "FR");
      const digits = v.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return "Vérifiez le numéro et l'indicatif du pays.";
      return null;
    }
    case "url": {
      if (!URL_RE.test(String(value).trim())) return "Cette adresse web semble incorrecte. Exemple : https://exemple.com";
      return null;
    }
    case "short_text":
    case "first_name":
    case "last_name":
    case "full_name":
    case "company":
    case "job_title":
    case "city": {
      const v = String(value).trim();
      if (field.options.maxLength && v.length > field.options.maxLength) return `Maximum ${field.options.maxLength} caractères.`;
      if (field.options.minLength && v.length < field.options.minLength) return `Minimum ${field.options.minLength} caractères.`;
      return null;
    }
    case "long_text": {
      const v = String(value).trim();
      if (field.options.maxLength && v.length > field.options.maxLength) return `Maximum ${field.options.maxLength} caractères.`;
      return null;
    }
    case "integer": {
      const n = Number(value);
      if (!Number.isInteger(n)) return "Saisissez un nombre entier.";
      if (field.options.min !== undefined && n < field.options.min) return `La valeur minimale est ${field.options.min}.`;
      if (field.options.max !== undefined && n > field.options.max) return `La valeur maximale est ${field.options.max}.`;
      return null;
    }
    case "decimal": {
      const n = Number(String(value).replace(",", "."));
      if (Number.isNaN(n)) return "Saisissez un montant valide.";
      if (field.options.min !== undefined && n < field.options.min) return `La valeur minimale est ${field.options.min}.`;
      if (field.options.max !== undefined && n > field.options.max) return `La valeur maximale est ${field.options.max}.`;
      return null;
    }
    case "date":
    case "birthdate": {
      const v = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Saisissez une date valide.";
      const d = new Date(v + "T00:00:00Z");
      if (Number.isNaN(d.getTime())) return "Saisissez une date valide.";
      if (field.type === "birthdate") {
        const now = new Date();
        let age = now.getUTCFullYear() - d.getUTCFullYear();
        const m = now.getUTCMonth() - d.getUTCMonth();
        if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
        if (age < 0) return "Cette date est dans le futur.";
        if (age > 120) return "Vérifiez cette date de naissance.";
      }
      return null;
    }
    case "time": {
      if (!/^\d{2}:\d{2}$/.test(String(value))) return "Saisissez une heure valide (HH:mm).";
      return null;
    }
    case "rating_stars":
    case "number_scale":
    case "nps": {
      const n = Number(value);
      if (Number.isNaN(n)) return "Choisissez une valeur.";
      const max = field.options.maxValue ?? field.options.max ?? 5;
      const min = field.options.min ?? 0;
      if (n < min || n > max) return `La valeur doit être comprise entre ${min} et ${max}.`;
      return null;
    }
    case "likert": {
      const n = Number(value);
      const levels = field.options.levels ?? 5;
      if (!n || n < 1 || n > levels) return "Choisissez une option.";
      return null;
    }
    case "single_choice":
    case "dropdown":
    case "yes_no":
    case "yes_no_unknown":
    case "true_false":
    case "true_false_unknown": {
      const choices = field.options.choices ?? [];
      const v = String(value);
      const choice = choices.find((c) => c.value === v);
      if (!choice) return "Choisissez une option proposée.";
      if (choice.allowText) {
        // texte « Autre » requis — stocké dans `${key}_other`
        return null;
      }
      return null;
    }
    case "multiple_choice": {
      if (!Array.isArray(value)) return "Sélection invalide.";
      const choices = field.options.choices ?? [];
      for (const v of value) {
        if (!choices.some((c) => c.value === v)) return "Choisissez parmi les options proposées.";
      }
      return null;
    }
    case "hidden": {
      // valeur libre courte (source, campagne) — tronquée côté serveur, jamais bloquante
      return null;
    }
    default:
      return null;
  }
}

/** Formatage d'une réponse pour affichage / export (Annexe Q.10.2) */
export function formatAnswer(field: FormFieldDef, value: AnswerValue, opts?: { otherText?: Record<string, string> }): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "";
  const otherText = opts?.otherText ?? {};
  switch (field.type) {
    case "consent":
      return value === true ? "Oui" : "Non";
    case "yes_no": case "yes_no_unknown": case "true_false": case "true_false_unknown":
    case "single_choice": case "dropdown": {
      const v = String(value);
      const c = (field.options.choices ?? []).find((x) => x.value === v);
      const label = c ? c.label : v;
      const other = otherText[field.key];
      return other ? `${label} — ${other}` : label;
    }
    case "multiple_choice": {
      if (!Array.isArray(value)) return String(value);
      return value
        .map((v) => {
          const c = (field.options.choices ?? []).find((x) => x.value === v);
          const other = otherText[`${field.key}__${v}`];
          return (c ? c.label : v) + (other ? ` — ${other}` : "");
        })
        .join(" ; ");
    }
    case "phone": {
      const v = String(value);
      return v.startsWith("+") ? v : normalizePhone(v, field.options.defaultCountry ?? "FR");
    }
    case "country":
      return countryName(String(value));
    case "likert": {
      const levels = field.options.levels ?? 5;
      const labels = LIKERT_LABELS[levels] ?? LIKERT_LABELS[5];
      const idx = Number(value) - 1;
      return labels[idx] ?? String(value);
    }
    case "nps":
    case "number_scale":
    case "rating_stars":
      return `${value} / ${field.options.maxValue ?? field.options.max ?? 5}`;
    case "decimal": {
      const n = Number(String(value).replace(",", "."));
      if (Number.isNaN(n)) return String(value);
      return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + (field.options.currency ? ` ${field.options.currency}` : "");
    }
    case "date":
    case "birthdate": {
      const d = new Date(String(value) + "T00:00:00Z");
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
    }
    case "url":
      return String(value);
    default:
      return String(value);
  }
}

/** Le type attend un texte « Autre (précisez) » ? */
export function hasOtherOption(field: FormFieldDef): boolean {
  return (field.options.choices ?? []).some((c) => c.allowText);
}

export function isContentBlock(type: FieldType): boolean {
  return !FIELD_CATALOG[type]?.isQuestion;
}
