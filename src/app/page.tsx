"use client";

// ============================================================
// MEAH COLLECT — Plateforme de formulaires collaboratifs à liens dérivés
// Page unique « / » : routeur de vues interne (query params).
// ============================================================

import { useEffect, useState } from "react";
import { useAppRouter } from "@/lib/router";
import { useApp } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { AuthPage } from "@/components/app/AuthPage";
import { PublicFormPage } from "@/components/app/PublicFormPage";
import { InvitePage } from "@/components/app/InvitePage";
import { DashboardHome } from "@/components/app/DashboardHome";
import { SharePublish } from "@/components/app/SharePublish";
import { TeamPage } from "@/components/app/TeamPage";
import { MemberSpace } from "@/components/app/MemberSpace";
import { SettingsPage } from "@/components/app/SettingsPage";
import { AdminPage } from "@/components/app/AdminPage";
import { FormBuilder } from "@/components/builder/FormBuilder";
import { ResponsesDashboard } from "@/components/responses/ResponsesDashboard";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand/Logo";
import { INTENDED_VIEW_KEY } from "@/lib/router";
import dynamic from "next/dynamic";
import type { AppView } from "@/lib/types";

const LandingPage = dynamic(
  () => import("@/components/landing/LandingPage").then((m) => m.LandingPage),
  { ssr: false }
);

const PUBLIC_VIEWS = new Set<AppView["name"]>(["landing", "auth", "invite", "publicForm"]);

export default function Page() {
  const { view, navigate } = useAppRouter();
  const { user, booted, refreshMe } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    refreshMe();
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Utilisateur connecté revenant sur l'écran de connexion/inscription → tableau de bord
  // (l'écran « verify » reste accessible : la session est posée avant vérification).
  useEffect(() => {
    if (user && booted && view.name === "auth" && view.mode !== "verify") {
      navigate({ name: "dashboard" }, { replace: true });
    }
  }, [user, booted, view, navigate]);

  // Vue protégée demandée sans session : on la mémorise pour y revenir après connexion.
  useEffect(() => {
    if (!user && booted && !PUBLIC_VIEWS.has(view.name)) {
      try {
        sessionStorage.setItem(INTENDED_VIEW_KEY, JSON.stringify(view));
      } catch {
        /* stockage indisponible */
      }
    }
  }, [user, booted, view]);

  // Pages publiques (accessibles sans compte) — rendu immédiat après montage
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <BrandLogo size={56} />
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  if (view.name === "publicForm") return <PublicFormPage slug={view.slug} />;
  if (view.name === "invite") return <InvitePage token={view.token} />;
  if (view.name === "landing") return <LandingPage />;

  // Vues authentifiées : redirection implicite vers la connexion
  if (view.name === "auth" || !user || !booted) {
    if (!booted && !user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return <AuthPage view={view.name === "auth" ? view : { name: "auth", mode: "login" }} />;
  }

  // Application (header + contenu)
  return <AppShell>{renderView(view)}</AppShell>;
}

function renderView(view: ReturnType<typeof useAppRouter>["view"]) {
  switch (view.name) {
    case "builder":
      return <FormBuilder formId={view.formId} />;
    case "share":
      return <SharePublish formId={view.formId} />;
    case "team":
      return <TeamPage formId={view.formId} />;
    case "responses":
      return <ResponsesDashboard formId={view.formId} scope={view.scope} />;
    case "memberSpace":
      return <MemberSpace formId={view.formId} />;
    case "settings":
      return <SettingsPage />;
    case "admin":
      return <AdminPage />;
    case "dashboard":
    default:
      return <DashboardHome />;
  }
}
