// ============================================================
// Types partagés client/serveur — contrat unique du projet
// ============================================================

export type FieldType =
  // Famille 1 — Texte et identité
  | "short_text" | "long_text" | "first_name" | "last_name" | "full_name"
  | "email" | "phone" | "url" | "company" | "job_title" | "city" | "country" | "hidden"
  // Famille 2 — Choix
  | "single_choice" | "multiple_choice" | "dropdown"
  | "yes_no" | "yes_no_unknown" | "true_false" | "true_false_unknown" | "consent"
  // Famille 3 — Échelles et évaluation
  | "rating_stars" | "number_scale" | "nps" | "likert"
  // Famille 4 — Nombres, dates et durées
  | "integer" | "decimal" | "date" | "birthdate" | "time"
  // Famille 7 — Blocs de contenu (non-questions)
  | "section_title" | "paragraph_text" | "image_block" | "callout"
  | "divider" | "page_break" | "welcome_screen" | "end_screen";

export interface ChoiceOption {
  value: string;
  label: string;
  allowText?: boolean; // option « Autre (précisez) »
  exclusive?: boolean; // « Aucun de ces choix »
}

export interface FieldOptions {
  placeholder?: string;
  help?: string; // texte d'aide sous la question
  minLength?: number;
  maxLength?: number;
  choices?: ChoiceOption[];
  min?: number; // nombre / échelle
  max?: number;
  step?: number;
  maxValue?: number; // nps (10), étoiles (5), likert…
  labels?: { left?: string; right?: string }; // extrémités d'échelle
  levels?: number; // likert : 3 | 5 | 7
  layout?: "vertical" | "horizontal";
  defaultCountry?: string; // téléphone (indicatif)
  imageUrl?: string; // image_block
  content?: string; // paragraph_text / callout / welcome / end screen
  includeTime?: boolean; // date
  randomize?: boolean; // mélanger les options
  otherLabel?: string;
  consentText?: string; // consent
  privacyUrl?: string;
  currency?: string; // decimal (montant)
  unit?: string;
}

export interface FormFieldDef {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  position: number;
  options: FieldOptions;
  /** Page/étape calculée via les page_break (rendu uniquement) */
}

export interface FormTheme {
  accent?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface FormSettings {
  finalMessage?: string;
  redirectUrl?: string;
  closesAt?: string | null; // ISO
  maxSubmissions?: number | null;
  dedup?: { enabled: boolean; keys: ("email" | "phone")[]; mode: "block" | "warn" };
  consentText?: string;
  showBranding?: boolean;
  allowAnother?: boolean; // bouton « Remplir un autre formulaire »
  estimateMinutes?: number;
  notifyOwner?: boolean;
  notifyMember?: boolean;
  introText?: string;
}

// ---------- Utilisateurs ----------
export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  role: "user" | "admin";
  emailVerified: boolean;
  locale: string;
  timezone: string;
  notifyOnResponse: boolean;
  notifyOnMember: boolean;
  dailyDigest: boolean;
}

// ---------- DTO API ----------
export interface FormSummaryDTO {
  id: string;
  title: string;
  description?: string | null;
  status: FormStatus;
  mode: string;
  displayMode: string;
  theme: FormTheme;
  settings: FormSettings;
  submissionsCount: number;
  todayCount: number;
  membersCount: number;
  updatedAt: string;
  createdAt: string;
  ownerName?: string; // pour les équipes rejointes
  myRole?: "owner" | "member";
}

export type FormStatus = "draft" | "published" | "closed" | "archived";

export interface InvitationDTO {
  id: string;
  token: string;
  isActive: boolean;
  expiresAt?: string | null;
  maxUses?: number | null;
  usesCount: number;
  createdAt: string;
}

export interface MemberDTO {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  role: "owner" | "member";
  status: "active" | "disabled" | "removed";
  joinedAt: string;
  slug?: string;
  slugActive?: boolean;
  submissionsCount: number;
  last7: number;
}

export interface PublicFormDTO {
  slug: string;
  title: string;
  description?: string | null;
  theme: FormTheme;
  settings: FormSettings;
  displayMode: string;
  fields: FormFieldDef[];
  collectorName: string; // « Collecté par Marie-Antoinette »
  collectorAvatar?: string | null;
  isOwnerLink: boolean;
  brandName: string;
}

export interface InvitationPreviewDTO {
  formTitle: string;
  formDescription?: string | null;
  ownerName: string;
  ownerAvatar?: string | null;
  fields: FormFieldDef[];
  membersCount: number;
  submissionsCount: number;
  state: "ok" | "invalid" | "expired" | "full" | "self" | "already_member";
}

export interface SubmissionRowDTO {
  id: string;
  formId: string;
  submittedAt: string;
  leadStatus: string;
  internalNote?: string | null;
  isFlagged: boolean;
  durationSec?: number | null;
  memberName: string; // « Collecté par »
  memberSlug: string;
  values: Record<string, string>; // valeurs formatées pour affichage/export
  raw: Record<string, unknown>;
}

export interface StatsDTO {
  total: number;
  today: number;
  last7: number;
  last30: number;
  evolution: { date: string; count: number }[];
  byMember: { memberId: string; name: string; count: number }[];
  byStatus: Record<string, number>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

// Vues du routeur interne (l'utilisateur ne voit que « / »)
export type AppView =
  | { name: "landing" }
  | { name: "auth"; mode: "login" | "signup" | "verify" | "forgot" | "reset"; token?: string; inviteToken?: string }
  | { name: "dashboard" }
  | { name: "builder"; formId: string }
  | { name: "share"; formId: string }
  | { name: "team"; formId: string }
  | { name: "responses"; formId: string; scope: "mine" | "all" }
  | { name: "settings" }
  | { name: "admin" }
  | { name: "memberSpace"; formId: string }
  | { name: "invite"; token: string }
  | { name: "publicForm"; slug: string };
