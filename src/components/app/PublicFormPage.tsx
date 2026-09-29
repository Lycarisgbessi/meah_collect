"use client";

// ============================================================
// PublicFormPage — écran 10 (Module E) : formulaire public via lien dérivé
// Gère tous les états E-09 : lien invalide, formulaire clos,
// membre désactivé, quota atteint, formulaire pas encore publié.
// ============================================================

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormRenderer } from "@/components/form-renderer/FormRenderer";
import { api } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

interface PublicFormDTOShape {
  slug: string;
  title: string;
  description?: string | null;
  theme: { accent?: string; logoUrl?: string; bannerUrl?: string };
  settings: { estimateMinutes?: number; consentText?: string; finalMessage?: string; showBranding?: boolean; allowAnother?: boolean };
  displayMode: string;
  fields: Parameters<typeof FormRenderer>[0]["fields"];
  collectorName: string;
}

export function PublicFormPage({ slug }: { slug: string }) {
  const { navigate } = useAppRouter();
  const [form, setForm] = useState<PublicFormDTOShape | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const previousTitle = document.title;
    api.get<PublicFormDTOShape>(`/api/f/${slug}`)
      .then((f) => {
        if (!alive) return;
        setForm(f);
        setState("ok");
        document.title = `${f.title} — MEAH COLLECT`;
      })
      .catch((err) => {
        if (!alive) return;
        setError({ message: err.message ?? "Ce lien est introuvable.", code: err.code });
        setState("error");
      });
    return () => {
      alive = false;
      document.title = previousTitle;
    };
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <div className="mt-6 w-full max-w-xl space-y-3">
          <Skeleton className="h-8 w-2/3 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (state === "error" || !form) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </span>
        <h1 className="font-display mt-6 text-2xl font-semibold">
          {error?.code === "FORM_CLOSED" && "Formulaire clos"}
          {error?.code === "MEMBER_INACTIVE" && "Lien inactif"}
          {error?.code === "QUOTA_REACHED" && "Limite atteinte"}
          {error?.code === "FORM_NOT_PUBLISHED" && "Formulaire indisponible"}
          {(!error?.code || error?.code === "LINK_INVALID") && "Lien introuvable"}
        </h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">{error?.message}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Contactez la personne qui vous a partagé ce lien si vous pensez qu'il s'agit d'une erreur.
        </p>
        <Button variant="ghost" className="mt-8" onClick={() => navigate({ name: "landing" }, { replace: true })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Aller à l'accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FormRenderer
        fields={form.fields}
        theme={form.theme}
        settings={form.settings}
        displayMode={form.displayMode}
        mode="live"
        slug={slug}
        collectorName={form.collectorName}
        estimateMinutes={form.settings.estimateMinutes}
        className="pt-8"
      />
    </div>
  );
}
