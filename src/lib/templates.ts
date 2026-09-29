// ============================================================
// Modèles de formulaires prêts à l'emploi — Annexe Q.12 (sélection v1)
// ============================================================

import type { FormFieldDef, FieldType } from "./types";

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Omit<FormFieldDef, "position">[];
}

function f(key: string, label: string, type: FieldType, isRequired = false, options: FormFieldDef["options"] = {}): Omit<FormFieldDef, "position"> {
  return { key, label, type, isRequired, options };
}

export const TEMPLATES: FormTemplate[] = [
  {
    id: "blank",
    name: "Vierge",
    description: "Partez d'une page blanche et construisez librement.",
    icon: "FilePlus2",
    fields: [],
  },
  {
    id: "contact",
    name: "Prise de contact simple",
    description: "Nom, coordonnées et message — l'essentiel pour être rappelé.",
    icon: "MessageSquare",
    fields: [
      f("prenom", "Votre prénom", "first_name", true),
      f("nom", "Votre nom", "last_name", true),
      f("telephone", "Votre numéro de téléphone", "phone", true),
      f("email", "Votre adresse e-mail", "email", false),
      f("message", "Votre message", "long_text", false, { placeholder: "Comment pouvons-nous vous aider ?" }),
      f("consentement", "Consentement", "consent", true),
    ],
  },
  {
    id: "prospect",
    name: "Collecte de prospects",
    description: "Identité, besoin, budget et consentement pour votre force de vente.",
    icon: "Target",
    fields: [
      f("prenom", "Votre prénom", "first_name", true),
      f("nom", "Votre nom", "last_name", true),
      f("ville", "Votre ville", "city", true),
      f("telephone", "Votre numéro de téléphone", "phone", true),
      f("besoin", "Quel est votre besoin ?", "single_choice", true, {
        choices: [
          { value: "decouverte", label: "Découvrir l'offre" },
          { value: "devis", label: "Demander un devis" },
          { value: "rdv", label: "Prendre rendez-vous" },
        ],
      }),
      f("budget", "Budget envisagé", "decimal", false, { currency: "EUR" }),
      f("consentement", "Consentement", "consent", true),
    ],
  },
  {
    id: "event",
    name: "Inscription à un événement",
    description: "Inscriptions avec atelier, restrictions alimentaires et accompagnants.",
    icon: "CalendarCheck",
    fields: [
      f("prenom", "Votre prénom", "first_name", true),
      f("nom", "Votre nom", "last_name", true),
      f("email", "Votre adresse e-mail", "email", true),
      f("telephone", "Votre numéro de téléphone", "phone", true),
      f("atelier", "Atelier choisi", "single_choice", true, {
        choices: [
          { value: "matin", label: "Atelier du matin" },
          { value: "apresmidi", label: "Atelier de l'après-midi" },
        ],
      }),
      f("accompagnants", "Nombre d'accompagnants", "integer", false, { min: 0, max: 5 }),
      f("regime", "Restrictions alimentaires", "short_text", false, { placeholder: "Allergies, végétarien…" }),
      f("consentement", "Consentement", "consent", true),
    ],
  },
  {
    id: "satisfaction",
    name: "Enquête de satisfaction",
    description: "Étoiles, NPS et Likert pour mesurer la satisfaction client.",
    icon: "Star",
    fields: [
      f("note_globale", "Comment évaluez-vous votre expérience globale ?", "rating_stars", true, { maxValue: 5 }),
      f("nps", "Recommanderiez-vous nos services ?", "nps", true, { min: 0, max: 10, labels: { left: "Pas du tout probable", right: "Très probable" } }),
      f("accueil", "L'accueil vous a-t-il satisfait ?", "likert", true, { levels: 5 }),
      f("delai", "Le respect des délais vous a-t-il satisfait ?", "likert", true, { levels: 5 }),
      f("commentaire", "Un commentaire ou une suggestion ?", "long_text", false),
    ],
  },
  {
    id: "newsletter",
    name: "Inscription à une liste",
    description: "Newsletter ou liste d'attente avec centres d'intérêt.",
    icon: "MailPlus",
    fields: [
      f("prenom", "Votre prénom", "first_name", true),
      f("email", "Votre adresse e-mail", "email", true),
      f("interets", "Vos centres d'intérêt", "multiple_choice", false, {
        choices: [
          { value: "actus", label: "Actualités" },
          { value: "offres", label: "Offres promotionnelles" },
          { value: "evenements", label: "Invitations aux événements" },
        ],
      }),
      f("consentement", "Consentement", "consent", true),
    ],
  },
];

export function templateFields(templateId: string): Omit<FormFieldDef, "position">[] {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  return t.fields;
}
