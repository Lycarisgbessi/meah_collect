"use client";

// ============================================================
// MemberSpace — écran 8 (F.7 / D-03..D-06) : « Mon lien »
// Lien personnel, QR téléchargeable, partage, indicateurs perso,
// aperçu du formulaire, accès au tableau de bord personnel.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAppRouter, publicFormUrl } from "@/lib/router";
import { QrImage, ShareButtons } from "@/components/app/SharePublish";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Copy, Check, ArrowLeft, Inbox, Clock3, Users, Eye, BarChart3, Ban, RefreshCw,
} from "lucide-react";

interface MyLinkData {
  slug: string;
  isActive: boolean;
  memberStatus: string;
  myRole: "owner" | "member";
  form: { id: string; title: string; description?: string | null; status: string };
  ownerName: string;
  stats: { total: number; today: number; last7: number };
}

export function MemberSpace({ formId }: { formId: string }) {
  const { navigate } = useAppRouter();
  const [data, setData] = useState<MyLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const d = await api.get<MyLinkData>(`/api/my-link/${formId}`);
      setData(d);
    } catch {
      setFailed(true);
      toast.error("Impossible de charger votre espace.");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(publicFormUrl(data.slug));
      setCopied(true);
      toast.success("Lien copié ✓");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (failed || !data) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Impossible de charger votre espace membre.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}>Réessayer</Button>
          <Button variant="ghost" onClick={() => navigate({ name: "dashboard" })}>Retour à mes formulaires</Button>
        </div>
      </div>
    );
  }

  const url = publicFormUrl(data.slug);
  const inactive = !data.isActive;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate({ name: "dashboard" })}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Mon espace
      </button>

      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Mon lien de collecte</h1>
      <p className="mt-1 text-muted-foreground">
        {data.myRole === "owner" ? "Votre lien d'initiateur pour " : "Formulaire de "}
        <span className="font-medium text-foreground">{data.form.title}</span>
        {data.myRole === "member" && <> initié par {data.ownerName}</>}
      </p>

      {inactive && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Ce lien est actuellement inactif.</p>
            <p className="mt-0.5 text-xs opacity-80">
              {data.memberStatus === "disabled"
                ? "Votre accès a été suspendu par l'initiateur. Vos données collectées restent consultables en lecture."
                : "Le formulaire ou votre accès n'est pas actif."}
            </p>
          </div>
        </div>
      )}

      {/* Lien + QR */}
      <Card className="mt-6 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <code className={cn("h-11 min-w-0 flex-1 truncate rounded-lg border border-input bg-muted/50 px-3 text-[13px] leading-[2.75rem]", inactive && "opacity-50")}>
                  {url}
                </code>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={copy} aria-label="Copier mon lien">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-3">
                <ShareButtons url={url} message={`Bonjour, remplissez ce formulaire : ${url}`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={() => window.open(url, "_blank")}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Aperçu du formulaire
                </Button>
                <Button size="sm" variant="secondary" className="h-9" onClick={() => navigate({ name: "responses", formId, scope: "mine" })}>
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Mes réponses
                </Button>
                {data.myRole === "owner" && (
                  <Button size="sm" variant="secondary" className="h-9" onClick={() => navigate({ name: "share", formId })}>
                    Partage & équipe
                  </Button>
                )}
              </div>
            </div>
            <div className="shrink-0 text-center">
              <QrImage url={url} size={160} />
              <p className="mt-2 text-[11px] text-muted-foreground">Scannez pour tester</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicateurs personnels (F.7) */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Inbox, label: "Total", value: data.stats.total },
          { icon: Clock3, label: "Aujourd'hui", value: data.stats.today },
          { icon: Users, label: "7 derniers jours", value: data.stats.last7 },
        ].map((s, i) => (
          <Card key={i} className="rounded-2xl border-border/80">
            <CardContent className="p-3 text-center sm:p-4">
              <s.icon className="mx-auto h-4 w-4 text-muted-foreground" />
              <p className="font-display mt-1.5 text-xl font-semibold sm:text-2xl">{s.value}</p>
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          D-05 : le formulaire est imposé par l&apos;initiateur — il ne peut pas être modifié depuis cet espace.
        </p>
        <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={load}>
          <RefreshCw className="mr-1.5 h-3 w-3" /> Actualiser
        </Button>
      </div>

      {data.form.status !== "published" && (
        <Badge variant="outline" className="mt-4">
          Formulaire {data.form.status === "draft" ? "en préparation" : data.form.status === "closed" ? "clôturé" : "archivé"} — votre lien est en pause.
        </Badge>
      )}
    </div>
  );
}
