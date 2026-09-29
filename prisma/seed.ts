// ============================================================
// Seed de démonstration — comptes, formulaire publié, équipe,
// liens dérivés et réponses réalistes réparties sur 20 jours.
// Exécution : bun prisma/seed.ts
// ============================================================

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

const SECRET = process.env.AUTH_SECRET || "meah-collect-dev-secret-change-me-in-production-9f2c";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `s2$${salt}$${hash}`;
}

const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function genSlug(len = 10): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

function daysAgo(n: number, hour = 10, min = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

const FIELDS = [
  { key: "prenom", label: "Votre prénom", type: "first_name", isRequired: true, options: {} },
  { key: "nom", label: "Votre nom", type: "last_name", isRequired: true, options: {} },
  { key: "ville", label: "Votre ville", type: "city", isRequired: true, options: {} },
  { key: "telephone", label: "Votre numéro de téléphone", type: "phone", isRequired: true, options: { defaultCountry: "FR" } },
  { key: "email", label: "Votre adresse e-mail", type: "email", isRequired: false, options: {} },
  { key: "besoin", label: "Quel est votre besoin ?", type: "single_choice", isRequired: true, options: { layout: "vertical", choices: [{ value: "decouverte", label: "Découvrir l'offre" }, { value: "devis", label: "Demander un devis" }, { value: "rdv", label: "Prendre rendez-vous" }] } },
  { key: "satisfaction", label: "Recommanderiez-vous nos services ?", type: "nps", isRequired: false, options: { min: 0, max: 10, labels: { left: "Pas du tout probable", right: "Très probable" } } },
  { key: "consentement", label: "Consentement", type: "consent", isRequired: true, options: { consentText: "J'accepte que mes informations soient utilisées dans le cadre de cette collecte." } },
];

const PROSPECTS = [
  ["Awa", "Diallo", "Conakry", "+224622000111", "awa.diallo@exemple.com", "devis", 9],
  ["Lucas", "Martin", "Lyon", "+33612340101", "lucas.martin@exemple.com", "rdv", 10],
  ["Sophie", "Bernard", "Paris", "+33612340202", "sophie.bernard@exemple.com", "decouverte", 8],
  ["Ibrahim", "Camara", "Conakry", "+224622000222", "ibrahim.camara@exemple.com", "rdv", 7],
  ["Emma", "Petit", "Bordeaux", "+33612340303", "emma.petit@exemple.com", "devis", 9],
  ["Fatou", "Barry", "Kankan", "+224622000333", null, "decouverte", 6],
  ["Thomas", "Dubois", "Nantes", "+33612340404", "thomas.dubois@exemple.com", "rdv", 10],
  ["Mariama", "Sow", "Conakry", "+224622000444", "mariama.sow@exemple.com", "devis", 8],
  ["Julie", "Moreau", "Toulouse", "+33612340505", null, "decouverte", 5],
  ["Mamadou", "Bah", "Kindia", "+224622000555", "mamadou.bah@exemple.com", "rdv", 9],
  ["Karim", "Benali", "Marseille", "+33612340606", "karim.benali@exemple.com", "devis", 7],
  ["Aïcha", "Toure", "Abidjan", "+225070708080", "aicha.toure@exemple.com", "rdv", 10],
  ["Hugo", "Leroy", "Lille", "+33612340707", null, "decouverte", 6],
  ["Kadiatou", "Kaba", "Conakry", "+224622000666", "kadiatou.kaba@exemple.com", "devis", 8],
  ["Nicolas", "Roux", "Strasbourg", "+33612340808", "nicolas.roux@exemple.com", "rdv", 9],
  ["Salif", "Keita", "Bamako", "+22376767676", "salif.keita@exemple.com", "decouverte", 7],
  ["Claire", "Fournier", "Rennes", "+33612340909", "claire.fournier@exemple.com", "devis", 9],
  ["Ousmane", "Cisse", "Conakry", "+224622000777", null, "rdv", 8],
  ["Laura", "Girard", "Nice", "+33612341010", "laura.girard@exemple.com", "decouverte", 10],
  ["Moussa", "Diallo", "Conakry", "+224622000888", "moussa.diallo@exemple.com", "devis", 6],
  ["Elodie", "Lambert", "Montpellier", "+33612341111", "elodie.lambert@exemple.com", "rdv", 9],
  ["Sekou", "Traore", "Conakry", "+224622000999", "sekou.traore@exemple.com", "decouverte", 7],
  ["Antoine", "Garnier", "Grenoble", "+33612341212", null, "devis", 8],
  ["Bintou", "Camara", "Conakry", "+224622001010", "bintou.camara@exemple.com", "rdv", 9],
] as const;

const STATUSES = ["new", "new", "new", "contacted", "contacted", "qualified", "converted", "converted", "lost", "new"];
const NOTES: Record<string, string> = {
  contacted: "Premier appel effectué, à relancer la semaine prochaine.",
  qualified: "Budget confirmé, proposer une démonstration.",
  converted: "Client signé ✨",
  lost: "Sans réponse après trois relances.",
};

async function main() {
  console.log("🌱 Seed — MEAH COLLECT");

  // Nettoyage (ordre respectant les dépendances)
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.export.deleteMany();
  await db.abuseReport.deleteMany();
  await db.submission.deleteMany();
  await db.collectionLink.deleteMany();
  await db.formMember.deleteMany();
  await db.teamInvitation.deleteMany();
  await db.formField.deleteMany();
  await db.formVersion.deleteMany();
  await db.form.deleteMany();
  await db.user.deleteMany();

  // ---- Comptes ----
  const admin = await db.user.create({
    data: { firstName: "Admin", lastName: "Meah", email: "admin@meahcollect.fr", passwordHash: hashPassword("Admin2026!"), role: "admin", emailVerified: true },
  });
  const jean = await db.user.create({
    data: { firstName: "Jean", lastName: "Dupont", email: "jean@demo.fr", passwordHash: hashPassword("Demo2026!"), emailVerified: true },
  });
  const marie = await db.user.create({
    data: { firstName: "Marie-Antoinette", lastName: "Kaba", email: "marie@demo.fr", passwordHash: hashPassword("Demo2026!"), emailVerified: true },
  });
  const sophie = await db.user.create({
    data: { firstName: "Sophie", lastName: "Marchand", email: "sophie@demo.fr", passwordHash: hashPassword("Demo2026!"), emailVerified: true },
  });
  console.log("✔ comptes créés (admin, jean, marie, sophie)");

  // ---- Formulaire principal publié ----
  const form = await db.form.create({
    data: {
      ownerId: jean.id,
      title: "Prospection Rentrée 2026",
      description: "Collecte des contacts intéressés par notre offre pour la rentrée.",
      theme: JSON.stringify({ accent: "#B08D57" }),
      settings: JSON.stringify({
        finalMessage: "Merci ! Vos informations ont bien été envoyées. Un conseiller vous recontacte très vite.",
        consentText: "Vos données sont utilisées uniquement dans le cadre de cette collecte. Elles ne seront jamais partagées sans votre accord.",
        showBranding: true,
        allowAnother: false,
        notifyOwner: true,
        notifyMember: true,
        estimateMinutes: 1,
        dedup: { enabled: false, keys: ["email"], mode: "block" },
      }),
      status: "published",
    },
  });
  const version = await db.formVersion.create({ data: { formId: form.id, versionNumber: 1, isPublished: true } });
  await db.form.update({ where: { id: form.id }, data: { currentVersionId: version.id } });

  let pos = 0;
  for (const f of FIELDS) {
    await db.formField.create({
      data: { versionId: version.id, key: f.key, label: f.label, type: f.type, isRequired: f.isRequired, position: pos, options: JSON.stringify(f.options) },
    });
    pos++;
  }

  // ---- Équipe : initiateur + 2 membres avec liens dérivés ----
  const ownerMember = await db.formMember.create({ data: { formId: form.id, userId: jean.id, role: "owner", status: "active" } });
  const ownerLink = await db.collectionLink.create({ data: { formId: form.id, memberId: ownerMember.id, slug: genSlug(10) } });

  const invitation = await db.teamInvitation.create({ data: { formId: form.id, token: crypto.randomBytes(32).toString("base64url"), createdBy: jean.id } });

  const marieMember = await db.formMember.create({ data: { formId: form.id, userId: marie.id, invitationId: invitation.id, role: "member", status: "active", joinedAt: daysAgo(22) } });
  const marieLink = await db.collectionLink.create({ data: { formId: form.id, memberId: marieMember.id, slug: genSlug(10) } });

  const sophieMember = await db.formMember.create({ data: { formId: form.id, userId: sophie.id, invitationId: invitation.id, role: "member", status: "active", joinedAt: daysAgo(18) } });
  const sophieLink = await db.collectionLink.create({ data: { formId: form.id, memberId: sophieMember.id, slug: genSlug(10) } });

  await db.teamInvitation.update({ where: { id: invitation.id }, data: { usesCount: 2 } });
  console.log("✔ formulaire publié + équipe (2 membres) + liens dérivés");

  // ---- Réponses réalistes réparties sur 20 jours ----
  let count = 0;
  for (let i = 0; i < PROSPECTS.length; i++) {
    const [prenom, nom, ville, tel, email, besoin, nps] = PROSPECTS[i];
    const useMarie = i % 2 === 0; // alternance des collecteurs
    const link = useMarie ? marieLink : sophieLink;
    const member = useMarie ? marieMember : sophieMember;
    const dayOffset = 20 - Math.floor((i / PROSPECTS.length) * 19); // du plus ancien au plus récent
    const submittedAt = daysAgo(dayOffset, 9 + (i % 8), (i * 7) % 60);
    const leadStatus = STATUSES[i % STATUSES.length];

    await db.submission.create({
      data: {
        formId: form.id,
        versionId: version.id,
        linkId: link.id,
        memberId: member.id,
        answers: JSON.stringify({
          prenom, nom, ville, telephone: tel,
          ...(email ? { email } : {}),
          besoin,
          ...(nps ? { satisfaction: nps } : {}),
          consentement: true,
        }),
        leadStatus,
        internalNote: NOTES[leadStatus] ?? null,
        ipHash: crypto.randomBytes(16).toString("hex"),
        userAgent: "Mozilla/5.0 (seed)",
        durationSec: 45 + ((i * 13) % 90),
        submittedAt,
      },
    });
    count++;
  }

  // 3 réponses du lien personnel de l'initiateur
  for (let i = 0; i < 3; i++) {
    const p = PROSPECTS[PROSPECTS.length - 3 + i];
    await db.submission.create({
      data: {
        formId: form.id, versionId: version.id, linkId: ownerLink.id, memberId: ownerMember.id,
        answers: JSON.stringify({ prenom: p[0], nom: p[1], ville: p[2], telephone: p[3], besoin: "decouverte", consentement: true }),
        leadStatus: "new",
        submittedAt: daysAgo(2 - i, 14 + i, 15),
        durationSec: 60,
      },
    });
    count++;
  }
  console.log(`✔ ${count} réponses réparties sur 20 jours`);

  // ---- Formulaire secondaire : enquête de satisfaction (brouillon) ----
  const survey = await db.form.create({
    data: {
      ownerId: jean.id,
      title: "Enquête de satisfaction clients",
      description: "Mesurer la satisfaction de nos clients après 3 mois d'abonnement.",
      theme: JSON.stringify({ accent: "#4A7C59" }),
      settings: JSON.stringify({ finalMessage: "Merci pour votre avis précieux !", showBranding: true, estimateMinutes: 2 }),
      status: "draft",
    },
  });
  const v2 = await db.formVersion.create({ data: { formId: survey.id, versionNumber: 1, isPublished: false } });
  await db.form.update({ where: { id: survey.id }, data: { currentVersionId: v2.id } });
  const surveyFields = [
    { key: "note_globale", label: "Comment évaluez-vous votre expérience globale ?", type: "rating_stars", isRequired: true, options: { maxValue: 5 } },
    { key: "nps", label: "Recommanderiez-vous nos services ?", type: "nps", isRequired: true, options: { min: 0, max: 10 } },
    { key: "accueil", label: "L'accueil vous a-t-il satisfait ?", type: "likert", isRequired: true, options: { levels: 5 } },
    { key: "commentaire", label: "Un commentaire ou une suggestion ?", type: "long_text", isRequired: false, options: { maxLength: 2000 } },
  ];
  pos = 0;
  for (const f of surveyFields) {
    await db.formField.create({ data: { versionId: v2.id, key: f.key, label: f.label, type: f.type, isRequired: f.isRequired, position: pos, options: JSON.stringify(f.options) } });
    pos++;
  }
  const surveyOwnerMember = await db.formMember.create({ data: { formId: survey.id, userId: jean.id, role: "owner", status: "active" } });
  await db.collectionLink.create({ data: { formId: survey.id, memberId: surveyOwnerMember.id, slug: genSlug(10) } });
  console.log("✔ formulaire secondaire (brouillon)");

  // ---- Notifications de démo ----
  await db.notification.createMany({
    data: [
      { userId: jean.id, type: "member_joined", payload: JSON.stringify({ memberName: "Marie-Antoinette Kaba", formTitle: "Prospection Rentrée 2026" }), createdAt: daysAgo(22) },
      { userId: jean.id, type: "member_joined", payload: JSON.stringify({ memberName: "Sophie Marchand", formTitle: "Prospection Rentrée 2026" }), createdAt: daysAgo(18) },
      { userId: jean.id, type: "new_submission", payload: JSON.stringify({ formTitle: "Prospection Rentrée 2026", summary: [{ label: "Votre prénom", value: "Awa" }, { label: "Votre nom", value: "Diallo" }] }), createdAt: daysAgo(1) },
      { userId: marie.id, type: "new_submission", payload: JSON.stringify({ formTitle: "Prospection Rentrée 2026", summary: [{ label: "Votre prénom", value: "Awa" }, { label: "Votre nom", value: "Diallo" }] }), createdAt: daysAgo(1) },
    ],
  });
  console.log("✔ notifications");
  console.log("✅ Seed terminé.");
  console.log("   Admin  : admin@meahcollect.fr / Admin2026!");
  console.log("   Jean   : jean@demo.fr / Demo2026!  (initiateur)");
  console.log("   Marie  : marie@demo.fr / Demo2026! (membre)");
  console.log("   Sophie : sophie@demo.fr / Demo2026! (membre)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
