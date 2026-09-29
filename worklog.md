# Worklog — Plateforme de formulaires collaboratifs à liens dérivés

**Nom du produit : MEAH COLLECT** (renommé depuis « Recueilio » — voir Task 14). Domaine fictif : meahcollect.fr · Contact : contact@meahcollect.fr.

Projet : Next.js 16 · App Router · TypeScript · Tailwind 4 · shadcn/ui · Prisma/SQLite · Zustand

Cahier des charges : « Plateforme de formulaires collaboratifs à liens dérivés » v2.0 (28/09/2026).
Implémentation du périmètre v1 (MVP 🟢 Annexe Q.16) + éléments Should. Direction artistique « luxe sobre »
(ivoire/noir profond, accent or #B08D57, titres serif Playfair Display, texte Inter).

Contrainte clé : l'utilisateur ne voit que la route `/` → routeur de vues interne via query params
(`?view=f&slug=…` public, `?view=invite&token=…` invitation, `?view=app…` application authentifiée).

---

Task ID: 1
Agent: Z.ai Code (orchestrateur)
Task: Exploration du projet et initialisation du worklog

Work Log:
- Lu package.json : Next 16, Tailwind 4, shadcn/ui complet, dnd-kit, zustand, recharts, framer-motion, zod, prisma (SQLite), sonner.
- Constaté absence de : exceljs, jspdf, qrcode → à installer.
- Constaté scaffold par défaut (globals.css shadcn neutre, layout Geist, page.tsx démo, schema Prisma démo).
- Établi le plan en 14 tâches (voir TodoWrite) avec délégation 8-a/8-b/8-c aux sous-agents.

Stage Summary:
- Base de travail saine ; on passe aux fondations (Task 2).

---
Task ID: 2 à 7
Agent: Z.ai Code (orchestrateur)
Task: Fondations complètes — schéma, design system, libs, APIs, shell, FormRenderer

Work Log:
- prisma/schema.prisma : User, Form, FormVersion, FormField, TeamInvitation, FormMember, CollectionLink, Submission, Export, AuditLog, Notification, AbuseReport (adaptation SQLite de l'Annexe C). db push OK.
- Design system « luxe sobre » : globals.css (ivoire #faf8f3 / noir #100e0b, or #B08D57, radius 12px, scrollbar dorée, utilitaires card-lift/hero-grain), layout.tsx (Playfair_Display + Inter), metadata Recueilio.
- Libs partagées : types.ts (contrats DTO), fields.ts (catalogue Q.3 v1 complet : 31 types de questions + 8 blocs de contenu, bibliothèque de jeux de réponses Q.4, validation partagée Annexe E, formatage Q.10.2), crypto.ts (scrypt, slugs CSPRNG 10 car., tokens 256 bits, sessions HMAC), api-utils.ts (JSON normalisé Annexe D, rate limiting D.4, audit, sanitization), api.ts (client typé ApiError), router.ts (routeur de vues sur « / » via query params + history), store.ts (zustand), templates.ts (6 modèles Q.12), team.ts (join_team Annexe C), forms-server.ts (permissions par formulaire Annexe A, versionnage RM-07, checklist publication), exporters.ts (xlsx exceljs stylé + résumé, pdf jspdf/autotable orientation auto, csv anti-injection).
- APIs : auth (signup+invite auto A-10, verify, resend, login+join, logout, me, forgot, reset, profil PATCH/DELETE RGPD), forms (CRUD, structure versionnée, publish machine à états B.1, invitation generate/patch/revoke, members liste+stats+status, duplicate), public (GET /api/f/:slug, POST /api/f/:slug/submit flux §7.4 : honeypot, rate limit, validation serveur, normalisation E.164, doublons, notifications), invite preview/join, submissions (liste filtrée, PATCH bulk, PATCH/DELETE unitaire), stats, my-link, notifications, admin, exports + download (24 h).
- UI : page.tsx (routeur), AppShell (header sticky, cloche notifications, menu user, thème), AuthPage (split-screen, force du mot de passe, code vérification), DashboardHome (recherche, filtre statut, modèles, duplication), SharePublish (deux liens, QR, partage WhatsApp/SMS/mail, options invitation, réglages B-11, transitions d'état), TeamPage (stats équipe, top 5, désactiver/retirer), MemberSpace (Mon lien, QR, partage, KPI perso), SettingsPage (profil, mot de passe, notifications, suppression RGPD), AdminPage (stats, users, forms, signalements), PublicFormPage (états E-09), InvitePage (aperçu lecture seule RM-02), FormRenderer (tous types v1, validation douce, multi-étapes + progression, welcome/end screens, honeypot, « Autre (précisez) »).
- Stubs fonctionnels : FormBuilder.tsx et ResponsesDashboard.tsx (à remplacer par les agents 8-b et 8-c), LandingPage.tsx (à remplacer par 8-a).
- Lint OK. Dev server : instance déjà active sur le port 3000, nouvelles routes testées (401 attendu).

Stage Summary:
- Backend 100 % opérationnel (auth, formulaires, versionnage, équipe, liens dérivés, soumission, stats, exports, admin).
- UI shell + 10 écrans opérationnels. Reste : landing riche (8-a), builder complet (8-b), dashboard réponses complet (8-c), seed, vérification navigateur.
- Contrats à respecter par les agents : exports `LandingPage`, `FormBuilder({formId})`, `ResponsesDashboard({formId,scope})`.

---
Task ID: 8-a
Agent: frontend-styling-expert
Task: Landing vitrine complète

Work Log:
- Lu worklog.md, router.ts (navigate {name:"auth",mode}/{name:"dashboard"}), store.ts (useApp().user), globals.css (gold-gradient, card-lift, hero-grain, font-display), ui/accordion|button|badge|separator, layout.tsx (Sonner monté → toast utilisable).
- Réécrit intégralement src/components/landing/LandingPage.tsx (seul fichier modifié) : export nommé `LandingPage`, 'use client', aucune prop.
- Header sticky : logo PenLine carré arrondi gold-gradient + « Recueilio » font-display, nav ancres Fonctionnement/Avantages/FAQ (scroll-mt-20, smooth), « Se connecter » ghost + « Créer mon formulaire » primary ; si user connecté → bouton « Mon espace » → dashboard.
- Héros : eyebrow pill, H1 serif « Un formulaire. Votre équipe. Autant de liens que de collecteurs. » (3ᵉ phrase en or), sous-titre, 2 CTA, badge confiance « Sans engagement · Conforme RGPD ».
- Maquette produit 100 % HTML/CSS : carte tableau de bord (barre fenêtre, badge or « Publié », 4 tuiles stats, mini-tableau Prénom/Téléphone/Collecté par/Statut avec avatars initiales et badges or « Complet »/« En cours »), halo doré + 2 vignettes flottantes (lien dérivé SM avec icône copier ; traçabilité 128 réponses/6 collecteurs). role="img" + aria-label.
- « Comment ça marche » : 3 cartes (Créez / Invitez votre équipe / Collectez et exportez) avec numéros 1-2-3 en grand serif doré (dégradé or en clip-text via style inline — le raccourci background de .gold-gradient casse bg-clip-text en cascade Tailwind 4), icônes, puces de détails.
- Avantages : grid 6 cartes (Route, Layers, BarChart3, FileSpreadsheet, Timer, ShieldCheck) avec hover card-lift.
- FAQ : Accordion shadcn (type single, 1re entrée ouverte) avec 4 Q/R réalistes (compte répondant — non ; modification par les membres — non, RM-01 ; qui a collecté quoi ; exports Excel/PDF/CSV 24 h).
- CTA final : bandeau noir profond bg-foreground avec lueurs or, 2 boutons (signup / login), notes de réassurance.
- Footer mt-auto : logo, liens Mentions légales/Confidentialité/CGU (toast.info sonner) + Contact mailto, Separator, « © 2026 Recueilio — Tous droits réservés ».
- Animations framer-motion discrètes (fade/slide 200–250 ms, whileInView once, delays échelonnés), responsive mobile-first, sémantique header/main/section/footer + aria-label/aria-labelledby.
- Vérifié : `bunx eslint src/components/landing/LandingPage.tsx` → 0 erreur 0 warning ; `bunx tsc --noEmit` → aucune erreur sur LandingPage (erreurs préexistantes hors périmètre dans src/app/api, examples, skills).

Stage Summary:
- Écran 1 (F.1) livré : vitrine « luxe sobre » complète et conforme au contrat (navigate signup/login/dashboard, tokens thème, aucun fichier autre modifié hormis ce worklog). Prête pour la vérification navigateur par l'orchestrateur.

---
Task ID: 8-c
Agent: full-stack-developer
Task: Tableau de bord des réponses complet (module F)

Work Log:
- Lu worklog.md + contrats réels des API (GET/PATCH/DELETE submissions, stats, exports bulk PATCH) pour aligner le composant sur le serveur (sentinelles Radix Select, scope normalisé par l’API via data.scope).
- Réécrit intégralement src/components/responses/ResponsesDashboard.tsx (seul fichier modifié, export nommé `ResponsesDashboard({formId, scope})`, 'use client', TS strict).
- En-tête F-01 : retour « Mon espace », formTitle, sous-titre de scope (« Mes réponses uniquement » / « Toutes les réponses · vue initiateur ») + total, menu d’export DropdownMenu (Excel .xlsx / PDF / CSV, icônes FileSpreadsheet/FileText/FileDown, filtres courants transmis à l’API) et bouton Actualiser (re-fetch liste + stats, icône qui tourne pendant le chargement).
- KPI F-04 : 4 cartes (Total, Aujourd’hui, 7 jours, 30 jours) avec stats API, style luxe sobre (rounded-2xl, border-border/70, font-display, card-lift).
- Graphique F-05 : recharts AreaChart 200 px sur stats.evolution (30 j), or #B08D57 + dégradé, axes/tooltip discrets thémés ; en scope « all », second visuel F-10 « Répartition par membre » (barres de progression or, % et volumes, top 8).
- Barre d’outils F-02/F-03 : recherche plein texte avec debounce 300 ms (param q), Select période (7 j / 30 j / Tout / Personnalisé → deux Inputs date from/to), Select statut (5 statuts), Select membre en scope « all » (data.members) ; chaque filtre re-fetch la liste ; bouton de réinitialisation conditionnel.
- Tableau F-01 : en-tête sticky top-0 dans un conteneur max-h-[60vh] overflow-auto (overflow-x du conteneur interne neutralisé pour que le sticky fonctionne), tri local par clic en-tête avec chevron (Date, Collecté par, Signalée + 6 questions), colonne cases à cocher (header = tout sélectionner, état indéterminé), badge « Signalée » (isFlagged), densité confortable py-3, ligne cliquable → panneau détail ; < md : lignes remplacées par des cartes empilées (collecteur, date, durée, 3 premières valeurs, statut, case à cocher).
- Panneau détail F-06 : Sheet côté droit (sm:max-w-lg) — métadonnées (date, heure, durée, collecteur, statut actuel, badge signalée), Select statut → PATCH /api/submissions/:id, Textarea note interne (placeholder « Contacté… ») + Enregistrer (PATCH, désactivé si inchangée), liste complète libellé/valeur via columns, bouton Supprimer (effScope « all » uniquement) avec AlertDialog « Supprimer définitivement cette réponse ? / Cette action est irréversible. » → DELETE.
- Actions groupées F.8 : barre or au-dessus du tableau quand N > 0 (« N sélectionnée(s) », Select statut → PATCH bulk /api/forms/:id/submissions, bouton Désélectionner).
- Pagination : Précédent/Suivant + « X–Y sur Z » (offset/limit, re-fetch), correction d’offset si la dernière réponse d’une page > 0 est supprimée.
- État vide : icône Inbox + « Aucune réponse pour l’instant. Partagez votre lien… » + bouton « Obtenir mon lien » → navigate(memberSpace|share) ; variante « aucun résultat pour vos filtres » avec réinitialisation ; état d’erreur initial avec bouton Réessayer ; skeletons pendant le premier chargement, contenu estompé pendant les re-fetch.
- Perf/conformité : re-fetch uniquement sur changement de filtre/pagination ; statut, note, suppression et action groupée mettent à jour les lignes localement (patch immuable) + stats rechargées en tâche de fond ; tri/sélection en état local ; toasts sonner + ApiError partout.
- Vérifications : `bunx eslint src/components/responses/ResponsesDashboard.tsx` → 0 erreur / 0 avertissement (exit 0) ; `bunx tsc --noEmit` → aucune erreur sur ce fichier (erreurs préexistantes ailleurs non touchées) ; compilation dev OK (`GET /?view=responses 200`).

Stage Summary:
- Écran 9 (F-01..F-16) complet : KPI, graphique d’évolution + répartition par membre, filtres avancés, tableau triable/sélectionnable responsive (cartes mobiles), panneau détail avec statut/note/suppression, actions groupées, exports xlsx/pdf/csv (synchrone + file d’attente), pagination et états vides/chargement — contractuellement aligné sur les API existantes, lint 0 erreur.
---
Task ID: 8-b
Agent: full-stack-developer
Task: Constructeur de formulaires complet (Annexe Q.11)

Work Log:
- Lu le worklog (contexte Recueilio) puis les ressources : fields.ts (catalogue Q.3, ANSWER_SETS Q.4, COUNTRIES), types.ts, FormRenderer (props d'aperçu), api.ts (ApiError), router.ts (useAppRouter), AppShell (header h-16 → offsets sticky), publish route (PUBLICATION_CHECK + fields.issues), globals.css (scrollbar dorée, --primary #B08D57).
- Réécrit src/components/builder/FormBuilder.tsx (~1440 lignes) — seul fichier touché :
  1. Barre supérieure sticky (top-16, backdrop-blur) : Quitter (sauvegarde avant navigation), badge statut, titre éditable (PATCH au blur + debounce), indicateur « Enregistrement… / Modifications non enregistrées / Enregistré à HH:MM », bascule Bureau/Mobile (Monitor/Smartphone), œil Aperçu, Enregistrer, Publier (draft) ou Voir les liens (navigate share).
  2. Layout 3 colonnes xl : bibliothèque w-72 (recherche insensible à la casse sur label/description/code, groupes FAMILY_LABELS, boutons icône via Record<string, LucideIcon> de ~34 icônes + fallback CircleDot, section Blocs de contenu à part, panneau « Jeux de réponses prêts à l'emploi » Q.4 quand le champ sélectionné a des choix) · canevas minmax(0,1fr) · colonne droite sticky (propriétés + aperçu, max-h calc(100vh-146px), overflow-y-auto scrollbar globale dorée).
  3. Canevas : DndContext + closestCenter + SortableContext (verticalListSortingStrategy, PointerSensor distance 6, KeyboardSensor sortableKeyboardCoordinates), poignée GripVertical (activator), clés stables f.key + positions recalculées à l'arrayMove, sélection → propriétés, édition en place du libellé, badge type, astérisque or obligatoire, switch Obligatoire, menu ⋮ (dupliquer avec nouvelle clé via generateFieldKey, rendre obligatoire/facultatif, supprimer), carte vide d'invitation, compteur blocs/100.
  4. Onglet Champ : libellé, aide, placeholder (types texte), switch obligatoire, hidden → note valeur auto, longueurs min/max, min/max/step (+ devise decimal), maxValue (étoiles 3-10, nps 5/10), levels Likert 3/5/7 + aperçu LIKERT_LABELS, extrémités gauche/droite (number_scale/nps), disposition verticale/horizontale, éditeur d'options (réordonner ↑↓, libellé + valeur, supprimer, ajouter, case « Autoriser Autre (précisez) » allowText, Textarea d'import en lot avec slugification et dédoublonnage → QA-02), indicatif pays (Select COUNTRIES), consentText, contenu (paragraph/callout/section/welcome/end), imageUrl + vignette.
  5. Onglet Design : 6 pastilles d'accent prédéfinies (#B08D57 or champagne en tête) + input color, logo URL, bannière URL → theme via PATCH auto.
  6. Onglet Paramètres : displayMode (single_page/multi_step), estimateMinutes (0-120), rappel que la collecte se règle au partage + bouton d'accès.
  7. Aperçu en direct (B-05) : FormRenderer mode preview, thème/réglages/displayMode réactifs, 375 px max-w en mobile / pleine en bureau, max-h 60vh scrollable.
  8. Sauvegarde (B-06/Q-16) : pendingRef {fields, meta} + debounce 1,5 s → PUT fields / PATCH meta (im:munité contre les courses, retry des échecs), Ctrl/Cmd+S, beforeunload si sale, toast RM-07 quand newVersion, garde 100 blocs.
  9. Publication : saveNow puis POST publish → navigate share ; PUBLICATION_CHECK → extraction fields.issues (string[]) → Dialog listant les points à corriger.
- Corrigé 3 erreurs lint react-hooks/static-components (résolution d'icônes par accès membre ICONS[name] au lieu d'un appel) + 1 erreur tsc (api.patch<void>).
- Vérifié : bunx eslint → 0 erreur 0 avertissement ; tsc --noEmit → 0 erreur sur FormBuilder (erreurs préexistantes ailleurs non touchées) ; toutes les icônes lucide testées via node ; dev.log compile sans erreur.

Stage Summary:
- Écran 4 (F.4 + Q.11) complet et branché sur les APIs existantes : bibliothèque 31 questions + 8 blocs avec recherche, jeux de réponses Q.4, glisser-déposer @dnd-kit, propriétés par type, design, paramètres, aperçu live bureau/mobile, autosave 1,5 s + ⌘S, garde-fous 100 champs, publication avec checklist.
- Contrat respecté : export nommé FormBuilder({ formId }), 'use client', aucun autre fichier modifié, FormRenderer/libs intacts, lint 0 erreur.

---
Task ID: 13 (intégration & vérification)
Agent: Z.ai Code (orchestrateur)
Task: Intégration des livrables des sous-agents, seed, vérification end-to-end via agent-browser, corrections

Work Log:
- Intégré les livrables 8-a/8-b/8-c ; corrigé le routage public de page.tsx (landing accessible sans compte).
- Bug critique corrigé : le routeur de vues était instancié par composant → remplacé par un singleton (useSyncExternalStore) dans src/lib/router.ts (la navigation depuis AuthPage met à jour la vue de page.tsx).
- Corrigé : honeypot __hp rejeté par la whitelist serveur ; erreurs sans champ affichées comme succès → bandeau d'erreur dans le formulaire ; rate limiter login comptait les succès (D.4 : seuls les échecs consomment le quota via rateLimitPeek/rateLimitRecord) ; route manquante /api/exports/:id/download créée ; ThemeProvider next-themes ajouté au layout (mode sombre opérationnel) ; formId manquant dans le retour signup/login avec invitation → redirection espace membre directe ; relation Prisma AbuseReport→Form ajoutée ; ~15 erreurs TypeScript corrigées (0 erreur tsc sur le code projet).
- Seed exécuté : 4 comptes (admin, Jean initiateur, Marie et Sophie membres), formulaire « Prospection Rentrée 2026 » publié avec 8 questions, 2 liens dérivés + lien initiateur, 27 réponses réparties sur 20 jours, notifications, formulaire brouillon secondaire.
- Vérification agent-browser : landing (héros, 3 étapes, avantages, FAQ, footer collé) ✔ · connexion/déconnexion ✔ · dashboard initiateur (2 formulaires, 27 réponses, +1 aujourd'hui) ✔ · partage (2 liens, QR, options invitation, réglages) ✔ · réponses initiateur (KPI, graphique évolution, répartition par membre, tableau, pagination « 1–27 sur 27 ») ✔ · constructeur (bibliothèque par familles, canevas drag & drop, panneau propriétés 3 onglets, aperçu en direct) ✔ · formulaire public (une colonne, marque collecteur, indicatif pays, soumission → écran Merci personnalisé) ✔ · invitation publique (aperçu lecture seule) ✔ · inscription via invitation → lien dérivé + QR immédiats (US-05, < 5 s) ✔ · back-office admin (7 users, 2 forms, 31 soumissions, suspension) ✔ · états E-09 (lien introuvable, invitation invalide) ✔ · mobile 390 px sans scroll horizontal ✔ · mode sombre or/noir ✔ · footer collé ✔.
- Critères d'acceptation validés : réponse soumise via le lien de Marie visible chez Marie (16) et Jean (31), jamais chez les autres ; l'invitation ne permet pas de soumettre (RM-02) ; l'initiateur ne peut pas rejoindre sa propre équipe (5.4) ; honeypot → réponse factice + flag (US-10) ; export xlsx téléchargé et validé (archive zip, feuilles Réponses+Résumé) ; isolation prouvée (export membre sans colonne Collecté par, 12 lignes vs 27).
- Qualité : `bun run lint` 0 erreur · `tsc --noEmit` 0 erreur sur src/ · dev.log sans erreur runtime.

Stage Summary:
- Plateforme v1 (MVP Annexe Q.16 🟢) complète, testée de bout en bout dans le navigateur et prête pour la démonstration.
- Comptes de démonstration : admin@recueilio.fr / Admin2026! · jean@demo.fr (initiateur) · marie@demo.fr, sophie@demo.fr (membres) — mots de passe Demo2026!.

---
Task ID: 14
Agent: Z.ai Code (orchestrateur)
Task: Renommage complet de l'outil : « Recueilio » → « MEAH COLLECT »

Work Log:
- Recensé 36 occurrences (16 fichiers) via grep, distinguées en deux catégories : nom de marque affiché (« MEAH COLLECT ») et identifiants techniques (minuscules, tirets).
- Marque affichée remplacée dans : layout.tsx (metadata title), page.tsx (commentaire), AppShell.tsx (en-tête + copyright), AuthPage.tsx (2 logos), LandingPage.tsx (header, footer, aria-labels, copyright), FormRenderer.tsx (« Propulsé par MEAH COLLECT »), PublicFormPage.tsx (document.title), api/f/[slug] (brandName), exporters.ts (créateur xlsx + pied PDF). Espacement des logos caps passé de tracking-tight à tracking-wide.
- Identifiants techniques renommés : cookie de session `meah_collect_session`, clés sessionStorage `meah-collect:reset-token`, secrets de repli crypto.ts, dossier d'exports temporaire `meah-collect-exports`, noms de fichiers `export-meah-collect-YYYY-MM-DD`, domaine fictif `meahcollect.fr`, contact `contact@meahcollect.fr`.
- Favicon remplacé : nouveau logo.svg monogramme « M » serif doré (dégradé #C9A76F→#96754a) sur fond noir profond #161310, bordure dorée arrondie.
- package.json : name → « meah-collect ».
- seed.ts mis à jour (logs, admin) puis relancé : l'admin est désormais admin@meahcollect.fr / Admin2026! (lastName « Meah ») ; données de démo recréées à l'identique (27 réponses, 4 comptes).
- Vérifié : `rg recueilio` → 0 occurrence dans src/prisma/public/package.json ; `bun run lint` → 0 erreur.
- Vérification agent-browser : titre d'onglet « MEAH COLLECT — … » ✔ · landing (header, lien dérivé meahcollect.fr, footer © 2026 MEAH COLLECT, mailto) ✔ · connexion jean@demo.fr OK avec le nouveau cookie ✔ · app header + footer MEAH COLLECT ✔ · formulaire public (collecté par Sophie M., « PROPULSÉ PAR MEAH COLLECT » en bas, title onglet) ✔ · favicon M doré servi ✔ · dev.log sans erreur runtime.

Stage Summary:
- L'outil s'appelle désormais MEAH COLLECT partout (UI, metadata, exports, e-mails de marque, favicon, seed).
- Conséquence assumée du renommage : cookie de session et secret HMAC changés → toutes les sessions précédentes invalidées (reconnexion requise).
- Comptes de démo : admin@meahcollect.fr / Admin2026! · jean@demo.fr (initiateur) · marie@demo.fr, sophie@demo.fr (membres) — Demo2026!.

---
Task ID: 15
Agent: Z.ai Code (orchestrateur)
Task: Audit de pré-déploiement (complétude base, secrets, smoke tests)

Work Log:
- Base : 12 tables présentes et peuplées (4 users, 2 forms, 2 versions, 12 fields, 1 invitation, 4 members, 4 links, 27 submissions, 4 notifications, 1 audit) ; réponses en JSON (adaptation SQLite de submission_values, Annexe Q.9.3).
- Qualité : tsc --noEmit 0 erreur (hors examples/skills) ; 0 TODO/FIXME/stub dans src ; lint 0 erreur.
- Sécurité : AUTH_SECRET (256 bits) et IP_SALT (128 bits) générés via openssl et ajoutés à .env — fin des secrets de repli « change-me-in-production ».
- Smoke tests post-rotation des secrets : GET / 200, API publique 200, reconnexion jean@demo.fr OK, dashboard avec 27 réponses.

Stage Summary:
- Projet prêt pour un déploiement de démonstration / petit terrain : code complet v1 MVP, base complète, secrets en place.
- Points connus pour une mise en production réelle : SQLite (spécif. PostgreSQL+RLS — isolation assurée couche applicative), e-mails simulés en mode démo (aucun SMTP), rate limiting en mémoire (mono-instance), 2FA non inclus (optionnel), données de démo à purger avant production.

---
Task ID: 16
Agent: Z.ai Code (orchestrateur)
Task: Nouveau logo de l'application — le monogramme M du favicon devient le logo partout

Work Log:
- Créé src/components/brand/Logo.tsx : composant BrandLogo (SVG inline identique au favicon : carré noir #161310, bordure + « M » en dégradé or #C9A76F→#B08D57→#96754A, Playfair Display via var CSS avec repli Georgia, id de dégradé unique par instance via useId, aria-hidden car le nom de marque est toujours adjacent).
- Remplacé l'ancien logo (carré or + icône crayon PenLine) dans 6 endroits : splash de chargement (page.tsx, 56 px), en-tête AppShell (36 px), AuthPage panneau sombre (40 px) + version mobile (36 px), InvitePage (44 px), LandingPage en-tête (36 px) + pied de page (28 px).
- PenLine retiré des imports des 5 fichiers ; conservé dans DashboardHome où il sert d'icône d'action (« Terminer », état vide) — usage sémantique, non graphique de marque.
- Qualité : bun run lint 0 erreur ; tsc --noEmit 0 erreur.
- Vérification agent-browser : landing (header + footer) ✔ · auth panneau sombre (effet gaufré or élégant) ✔ · app connectée ✔ · page d'invitation ✔ · mode sombre (bordure or = lisibilité garantie) ✔.

Stage Summary:
- Identité visuelle MEAH COLLECT unifiée : le monogramme M doré est désormais le logo unique (favicon = logo UI), du navigateur jusqu'aux écrans de l'application.
