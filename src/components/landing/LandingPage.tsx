"use client";

// ============================================================
// LandingPage — écran 1 (F.1) : page vitrine « MEAH COLLECT ».
// Direction artistique « luxe sobre » : ivoire / noir profond,
// accent or #B08D57, titres serif Playfair Display, texte Inter.
// Maquette produit 100 % HTML/CSS (aucune image externe).
// ============================================================

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  Layers,
  PenTool,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppRouter } from "@/lib/router";
import { useApp } from "@/lib/store";

// — Données statiques de la vitrine —

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { label: "Fonctionnement", href: "#fonctionnement" },
  { label: "Avantages", href: "#avantages" },
  { label: "FAQ", href: "#faq" },
];

interface MockStat {
  label: string;
  value: string;
}

const MOCK_STATS: MockStat[] = [
  { label: "Réponses", value: "128" },
  { label: "Collecteurs", value: "6" },
  { label: "Complétion", value: "94 %" },
  { label: "Exports", value: "12" },
];

interface MockRow {
  initials: string;
  name: string;
  phone: string;
  collector: string;
  complete: boolean;
}

const MOCK_ROWS: MockRow[] = [
  { initials: "AK", name: "Amine Kaci", phone: "+33 6 12 45 78 90", collector: "Sophie M.", complete: true },
  { initials: "LF", name: "Léa Fontaine", phone: "+33 7 84 21 09 55", collector: "Karim B.", complete: true },
  { initials: "MD", name: "Marc Delcourt", phone: "+33 6 45 88 30 12", collector: "Sophie M.", complete: false },
  { initials: "NB", name: "Nora Benali", phone: "+33 7 01 22 67 45", collector: "Julie R.", complete: true },
];

interface Step {
  num: string;
  icon: LucideIcon;
  title: string;
  text: string;
  chips: string[];
}

const STEPS: Step[] = [
  {
    num: "1",
    icon: PenTool,
    title: "Créez",
    text: "Composez la structure une seule fois dans le constructeur visuel : glisser-déposer, champs requis, écrans d’accueil et de confirmation personnalisés.",
    chips: ["Constructeur glisser-déposer", "70+ types de questions", "Modèles prêts à l’emploi"],
  },
  {
    num: "2",
    icon: UsersRound,
    title: "Invitez votre équipe",
    text: "Un seul lien d’invitation : chaque membre crée son compte et reçoit automatiquement son lien dérivé personnel, à partager en un clic.",
    chips: ["Un lien d’invitation unique", "Un lien dérivé par membre", "Partage WhatsApp · SMS · e-mail"],
  },
  {
    num: "3",
    icon: ClipboardCheck,
    title: "Collectez et exportez",
    text: "Chaque réponse est rattachée à son collecteur. Suivez l’avancement en temps réel et générez des rapports estampillés.",
    chips: ["Traçabilité par membre", "Exports Excel · PDF · CSV", "Téléchargement valable 24 h"],
  },
];

interface Benefit {
  icon: LucideIcon;
  title: string;
  text: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: Route,
    title: "Traçabilité totale",
    text: "Chaque réponse porte l’empreinte du lien dérivé qui l’a recueillie : membre, horodatage, formulaire et version exacts.",
  },
  {
    icon: Layers,
    title: "Structure imposée, collecte individualisée",
    text: "L’initiateur verrouille le questionnaire ; chaque collecteur dispose de son propre lien, sans jamais altérer les questions (RM-01).",
  },
  {
    icon: BarChart3,
    title: "Tableaux de bord par membre",
    text: "Vues individuelles et consolidées : volume de réponses, progression de l’équipe, top collecteurs en un coup d’œil.",
  },
  {
    icon: FileSpreadsheet,
    title: "Exports Excel / PDF / CSV",
    text: "Rapports mis en page et estampillés (date, initiateur), filtrables par membre et par période, téléchargeables 24 h.",
  },
  {
    icon: Timer,
    title: "Remplissage en moins d’une minute",
    text: "Formulaire public en marque blanche, optimisé mobile : le répondant répond et repart, sans créer de compte.",
  },
  {
    icon: ShieldCheck,
    title: "RGPD par défaut",
    text: "Consentement recueilli dès la première question, mot de passe jamais stocké en clair, suppression du compte et des données sur demande.",
  },
];

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqEntry[] = [
  {
    question: "Le répondant doit-il créer un compte ?",
    answer:
      "Non. Le répondant ouvre simplement le lien qu’on lui transmet et remplit le formulaire en marque blanche, sans inscription. Seuls les membres de votre équipe qui collectent créent un compte, afin de recevoir leur lien dérivé personnel.",
  },
  {
    question: "Chaque membre peut-il modifier le formulaire ?",
    answer:
      "Non. La structure est définie par l’initiateur puis verrouillée à la publication (règle RM-01) : les membres collectent avec leur lien dérivé, sans pouvoir ajouter, retirer ni modifier la moindre question.",
  },
  {
    question: "Comment savoir qui a collecté quoi ?",
    answer:
      "Chaque réponse est rattachée au lien unique du membre qui l’a recueillie. Vous consultez des tableaux de bord individuels et consolidés, et chaque export mentionne le collecteur, l’horodatage et la version du formulaire.",
  },
  {
    question: "Puis-je exporter mes réponses ?",
    answer:
      "Oui — Excel, PDF et CSV. Les exports sont estampillés (date, initiateur, formulaire), filtrables par membre et par période, et le lien de téléchargement reste valable 24 heures.",
  },
];

const LEGAL_LINKS: string[] = ["Mentions légales", "Confidentialité", "CGU"];

// Dégradé or appliqué en clip-text (style inline : le raccourci `background`
// de .gold-gradient réinitialiserait background-clip en CSS en couches).
const GOLD_TEXT_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(135deg, #c9a76f 0%, #b08d57 45%, #96703f 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const VIEWPORT_ONCE = { once: true, margin: "-80px" } as const;

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  id,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  id: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
      ) : null}
    </motion.div>
  );
}

export function LandingPage() {
  const { navigate } = useAppRouter();
  const { user } = useApp();

  const goToAuth = (mode: "signup" | "login") => navigate({ name: "auth", mode }, { replace: true });
  const goToDashboard = () => navigate({ name: "dashboard" }, { replace: true });

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showLegalNotice = (label: string) => {
    toast.info(label, { description: "Document de démonstration — le contenu définitif sera publié à la mise en ligne." });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ——— En-tête sticky ——— */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5"
            aria-label="MEAH COLLECT — revenir en haut de page"
          >
            <BrandLogo size={36} />
            <span className="hidden font-display text-lg font-semibold tracking-wide sm:inline">MEAH COLLECT</span>
          </button>

          <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button onClick={goToDashboard}>
                Mon espace
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="px-3 sm:px-4" onClick={() => goToAuth("login")}>
                  Se connecter
                </Button>
                <Button onClick={() => goToAuth("signup")}>
                  <span className="sm:hidden">Créer</span>
                  <span className="hidden sm:inline">Créer mon formulaire</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ——— Héros + maquette produit ——— */}
        <section className="hero-grain relative border-b border-border/40" aria-label="Présentation">
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                Formulaires collaboratifs à liens dérivés
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.06 }}
              className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.12] text-balance sm:text-6xl"
            >
              Un formulaire. Votre équipe.{" "}
              <span className="text-primary">Autant de liens que de collecteurs.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.12 }}
              className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Créez la structure une seule fois, invitez vos collaborateurs : chaque réponse est
              recueillie sous le nom du bon membre, traçable et exportable en un clic.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.18 }}
              className="mt-9 flex flex-wrap items-center justify-center gap-3"
            >
              <Button
                size="lg"
                className="h-12 px-7 text-base"
                onClick={user ? goToDashboard : () => goToAuth("signup")}
              >
                {user ? "Ouvrir mon espace" : "Créer mon formulaire"}
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base"
                onClick={() => scrollToSection("fonctionnement")}
              >
                Voir le fonctionnement
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.24 }}
              className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm"
            >
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Sans engagement · Conforme RGPD
            </motion.p>

            {/* Maquette produit : faux tableau de bord (HTML/CSS uniquement) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.2 }}
              className="relative mx-auto mt-16 w-full max-w-4xl sm:mt-20"
            >
              <div aria-hidden className="absolute inset-x-10 -top-8 h-32 rounded-full bg-primary/20 blur-3xl" />

              {/* Vignette flottante : lien dérivé */}
              <div
                aria-hidden
                className="absolute -top-6 right-2 z-10 hidden items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:flex lg:-right-8"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient text-[11px] font-semibold text-white">
                  SM
                </span>
                <span className="text-left">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Lien dérivé · Sophie M.
                  </span>
                  <span className="mt-0.5 block font-mono text-xs font-medium">meahcollect.fr/f/terrain-q3 · sm7k2</span>
                </span>
                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>

              {/* Vignette flottante : traçabilité */}
              <div
                aria-hidden
                className="absolute -bottom-6 left-2 z-10 hidden items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:flex lg:-left-8"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Route className="h-4.5 w-4.5" />
                </span>
                <span className="text-left">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Traçabilité par membre
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold">128 réponses rattachées à 6 collecteurs</span>
                </span>
              </div>

              <div
                role="img"
                aria-label="Aperçu du tableau de bord MEAH COLLECT : réponses fictives rattachées à leur collecteur"
                className="relative overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-[0_28px_70px_-30px_rgb(33_29_23/0.35)]"
              >
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-5 py-3.5">
                  <span className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </span>
                  <p className="ml-2 truncate text-xs font-medium sm:text-sm">Collecte terrain — Salon Q3</p>
                  <Badge className="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px]">Publié</Badge>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {MOCK_STATS.map((stat) => (
                      <div key={stat.label} className="rounded-xl border border-border/60 bg-muted/40 p-3.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <p className="mt-1 font-display text-2xl font-semibold">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th scope="col" className="px-4 py-3 font-medium">Prénom</th>
                          <th scope="col" className="px-4 py-3 font-medium">Téléphone</th>
                          <th scope="col" className="px-4 py-3 font-medium">Collecté par</th>
                          <th scope="col" className="px-4 py-3 text-right font-medium">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_ROWS.map((row) => (
                          <tr key={row.name} className="border-t border-border/50">
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                  {row.initials}
                                </span>
                                <span className="font-medium">{row.name}</span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{row.phone}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{row.collector}</td>
                            <td className="px-4 py-3 text-right">
                              {row.complete ? (
                                <Badge className="rounded-full px-2.5 py-0.5 text-[11px]">Complet</Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  En cours
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ——— Comment ça marche (3 étapes) ——— */}
        <section id="fonctionnement" aria-labelledby="fonctionnement-title" className="scroll-mt-20 border-b border-border/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <SectionHeading
              id="fonctionnement-title"
              eyebrow="Comment ça marche"
              title="Trois temps, une collecte irréprochable"
              subtitle="De la construction du formulaire au rapport final, la même exigence : structure maîtrisée, équipe autonome, données attribuées."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <motion.article
                  key={step.num}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT_ONCE}
                  transition={{ duration: 0.22, ease: "easeOut", delay: index * 0.06 }}
                  className="card-lift flex flex-col rounded-3xl border border-border/70 bg-card p-6 sm:p-8"
                >
                  <div className="flex items-start justify-between">
                    <span aria-hidden className="font-display text-5xl font-semibold sm:text-6xl" style={GOLD_TEXT_STYLE}>
                      {step.num}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                  <ul className="mt-5 space-y-2 border-t border-border/50 pt-4">
                    {step.chips.map((chip) => (
                      <li key={chip} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        {chip}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Avantages (6 cartes) ——— */}
        <section id="avantages" aria-labelledby="avantages-title" className="scroll-mt-20 border-b border-border/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <SectionHeading
              id="avantages-title"
              eyebrow="Avantages"
              title="Pensé pour les équipes de collecte exigeantes"
              subtitle="La rigueur d’un protocole, la souplesse d’un formulaire : tout ce dont votre terrain a besoin, rien de superflu."
            />

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((benefit, index) => (
                <motion.article
                  key={benefit.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT_ONCE}
                  transition={{ duration: 0.2, ease: "easeOut", delay: (index % 3) * 0.05 }}
                  className="card-lift rounded-2xl border border-border/70 bg-card p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <benefit.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ——— FAQ ——— */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
            <SectionHeading
              id="faq-title"
              eyebrow="FAQ"
              title="Les questions que l’on nous pose"
              subtitle="Et si la vôtre n’y figure pas, notre équipe vous répond sous 24 h ouvrées."
            />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mt-10 overflow-hidden rounded-3xl border border-border/70 bg-card px-5 sm:px-7"
            >
              <Accordion type="single" collapsible defaultValue="faq-0" className="w-full">
                {FAQ_ITEMS.map((item, index) => (
                  <AccordionItem key={item.question} value={`faq-${index}`} className="border-border/60 last:border-b-0">
                    <AccordionTrigger className="py-5 text-left text-sm font-medium hover:no-underline sm:text-base [&>svg]:text-primary">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* ——— CTA final ——— */}
        <section aria-labelledby="cta-title" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_ONCE}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background sm:px-14 sm:py-16"
          >
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
            <div aria-hidden className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full border border-primary/20" />

            <p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-primary">Prêt à démarrer ?</p>
            <h2
              id="cta-title"
              className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold text-balance sm:text-4xl"
            >
              Déployez votre équipe de collecte dès aujourd’hui
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-background/75 sm:text-base">
              Créez votre compte, publiez votre premier formulaire et partagez vos premiers liens
              dérivés en moins de dix minutes.
            </p>

            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="h-12 px-7 text-base" onClick={() => goToAuth("signup")}>
                Créer mon compte gratuitement
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/25 bg-transparent px-7 text-base text-background hover:bg-white/10 hover:text-background"
                onClick={() => goToAuth("login")}
              >
                J’ai déjà un compte
              </Button>
            </div>
            <p className="relative mt-5 text-xs text-background/60">
              Sans carte bancaire · Vos données restent exportables à tout moment
            </p>
          </motion.div>
        </section>
      </main>

      {/* ——— Pied de page ——— */}
      <footer className="mt-auto border-t border-border/60 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <span className="flex items-center gap-2">
                <BrandLogo size={28} />
                <span className="font-display text-base font-semibold tracking-wide">MEAH COLLECT</span>
              </span>
              <p className="text-xs text-muted-foreground">Formulaires collaboratifs à liens dérivés</p>
            </div>

            <nav aria-label="Liens légaux" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {LEGAL_LINKS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => showLegalNotice(label)}
                  className="transition-colors hover:text-foreground"
                >
                  {label}
                </button>
              ))}
              <a href="mailto:contact@meahcollect.fr" className="transition-colors hover:text-foreground">
                Contact
              </a>
            </nav>
          </div>

          <Separator className="my-6 opacity-70" />

          <p className="text-center text-xs text-muted-foreground">© 2026 MEAH COLLECT — Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
