"use client";

// ============================================================
// InvitePage — écran 7 (F.6) : page d'invitation publique
// « Jean Dupont vous invite à rejoindre… » + aperçu lecture seule
// de la structure (champs non saisissables). RM-02 : jamais remplissable.
// ============================================================

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api, ApiError } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import type { InvitationPreviewDTO } from "@/lib/types";
import { AlertCircle, ArrowRight, Ban, CalendarX2, ClipboardList, Hourglass, Users, Inbox } from "lucide-react";
import { BrandLogo } from "@/components/brand/Logo";

export function InvitePage({ token }: { token: string }) {
  const { navigate } = useAppRouter();
  const { user } = useApp();
  const [data, setData] = useState<InvitationPreviewDTO | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    api.get<InvitationPreviewDTO>(`/api/invite/${token}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <Skeleton className="mx-auto h-40 rounded-2xl" />
        <Skeleton className="mx-auto mt-4 h-64 rounded-2xl" />
      </div>
    );
  }

  if (state === "error" || !data || data.state === "invalid" || data.state === "expired" || data.state === "full") {
    const map: Record<string, { icon: typeof Ban; title: string; text: string }> = {
      invalid: { icon: Ban, title: "Lien d'invitation invalide", text: "Ce lien a été révoqué ou n'existe plus. Contactez la personne qui vous l'a envoyé." },
      expired: { icon: CalendarX2, title: "Invitation expirée", text: "Ce lien d'invitation a expiré. Demandez un nouveau lien à l'initiateur." },
      full: { icon: Hourglass, title: "Invitation complète", text: "Le nombre maximal d'inscriptions a été atteint pour ce lien." },
      error: { icon: AlertCircle, title: "Une erreur est survenue", text: "Réessayez plus tard." },
    };
    const info = map[!data || state === "error" ? "error" : data.state] ?? map.invalid;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <info.icon className="h-8 w-8 text-muted-foreground" />
        </span>
        <h1 className="font-display mt-6 text-2xl font-semibold">{info.title}</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">{info.text}</p>
        <Button variant="ghost" className="mt-8" onClick={() => navigate({ name: "landing" }, { replace: true })}>
          Aller à l'accueil
        </Button>
      </div>
    );
  }

  const questions = data.fields.filter((f) => f.type !== "welcome_screen" && f.type !== "end_screen");
  const alreadyHandled = data.state === "self" || data.state === "already_member";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-xl px-4 py-12">
        {/* Carte d'invitation */}
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-7 text-center">
            <BrandLogo size={44} className="mx-auto" />
            <Avatar className="mx-auto mt-6 h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={data.ownerAvatar ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {data.ownerName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <h1 className="font-display mt-4 text-2xl font-semibold leading-snug text-balance">
              {data.ownerName} vous invite à rejoindre son équipe
            </h1>
            <p className="mt-2 text-lg font-medium text-primary">{data.formTitle}</p>
            {data.formDescription && <p className="mt-1.5 text-sm text-muted-foreground">{data.formDescription}</p>}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {data.membersCount} membre(s)</span>
              <span className="flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" /> {data.submissionsCount} réponse(s) collectée(s)</span>
            </div>
          </CardContent>
        </Card>

        {/* Aperçu lecture seule de la structure (C-02) */}
        <Card className="mt-4 rounded-2xl border-border/80">
          <CardContent className="p-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="structure" className="border-0">
                <AccordionTrigger className="justify-center py-3 text-sm font-medium hover:no-underline">
                  <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Ce que vous allez collecter ({questions.length} question{questions.length > 1 ? "s" : ""})</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                    {questions.slice(0, 12).map((f, i) => (
                      <div key={f.key} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span>
                          {f.label}
                          {f.isRequired && <span className="ml-1 text-primary">*</span>}
                        </span>
                      </div>
                    ))}
                    {questions.length > 12 && <p className="text-xs text-muted-foreground">+ {questions.length - 12} autre(s) question(s)…</p>}
                    <p className="pt-1 text-center text-[11px] uppercase tracking-wider text-muted-foreground/70">Aperçu — non remplissable</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-8 space-y-3">
          {alreadyHandled ? (
            <Card className="rounded-2xl border-primary/30 bg-primary/5">
              <CardContent className="p-5 text-center text-sm">
                {data.state === "self" ? (
                  <>Vous êtes l'initiateur de ce formulaire — retrouvez-le dans votre espace.</>
                ) : (
                  <>Vous faites déjà partie de cette équipe.</>
                )}
              </CardContent>
            </Card>
          ) : user ? (
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={async () => {
                try {
                  const res = await api.post<{ formId: string; alreadyMember: boolean }>(`/api/invite/${token}/join`);
                  if (!res.alreadyMember) toast.success("Bienvenue dans l'équipe ! Votre lien personnel est prêt.");
                  navigate({ name: "memberSpace", formId: res.formId }, { replace: true });
                } catch (err) {
                  const e = err as ApiError;
                  if (e.code === "AUTH_REQUIRED") {
                    navigate({ name: "auth", mode: "login", inviteToken: token }, { replace: true });
                  } else {
                    toast.error(e.message || "Impossible de rejoindre l'équipe.");
                    // recharger l'état (invitation possiblement révoquée/saturée)
                    setState("loading");
                    api.get<InvitationPreviewDTO>(`/api/invite/${token}`)
                      .then((d) => { setData(d); setState("ok"); })
                      .catch(() => setState("error"));
                  }
                }
              }}
            >
              Rejoindre l&apos;équipe <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button size="lg" className="h-12 w-full text-base" onClick={() => navigate({ name: "auth", mode: "signup", inviteToken: token }, { replace: true })}>
                Rejoindre l'équipe <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="h-12 w-full text-base" onClick={() => navigate({ name: "auth", mode: "login", inviteToken: token }, { replace: true })}>
                J'ai déjà un compte
              </Button>
            </>
          )}
          <p className="pt-2 text-center text-[11px] text-muted-foreground/70">
            En rejoignant l'équipe, vous recevrez votre propre lien de collecte. Le formulaire reste défini par l'initiateur.
          </p>
        </div>
      </div>
    </div>
  );
}
