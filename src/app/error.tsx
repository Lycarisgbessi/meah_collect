"use client";

// ============================================================
// Error boundary applicatif — un crash de vue n'est plus un écran blanc.
// ============================================================

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/Logo";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] Erreur de rendu :", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8 text-center">
      <BrandLogo size={48} />
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <h2 className="font-display text-xl font-semibold">Une erreur inattendue est survenue</h2>
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        La page n&apos;a pas pu s&apos;afficher complètement. Vos données enregistrées ne sont pas affectées.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
          Retour à l&apos;accueil
        </Button>
      </div>
    </div>
  );
}
