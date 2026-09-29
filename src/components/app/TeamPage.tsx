"use client";

// ============================================================
// TeamPage — écran 6 (F.5) : gestion de l'équipe
// Liste des membres, statuts, statistiques, lien d'invitation.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Copy, Check, Loader2, ArrowLeft, Users, Trophy, Ban, RotateCcw, UserMinus, Link2, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppRouter, publicFormUrl } from "@/lib/router";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/app/SharePublish";
import type { MemberDTO } from "@/lib/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TeamPage({ formId }: { formId: string }) {
  const { navigate } = useAppRouter();
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [form, setForm] = useState<{ title: string; status: string }>({ title: "", status: "draft" });
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, f] = await Promise.all([
        api.get<{ members: MemberDTO[] }>(`/api/forms/${formId}/members`),
        api.get<{ title: string; status: string }>(`/api/forms/${formId}`),
      ]);
      setMembers(m.members);
      setForm({ title: f.title, status: f.status });
    } catch {
      toast.error("Impossible de charger l'équipe.");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const copyLink = async (m: MemberDTO) => {
    if (!m.slug) return;
    try {
      await navigator.clipboard.writeText(publicFormUrl(m.slug));
      setCopiedId(m.id);
      toast.success(`Lien de ${m.firstName} copié ✓`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Copie impossible.");
    }
  };

  const setStatusMember = async (m: MemberDTO, status: string) => {
    setBusyId(m.id);
    try {
      await api.patch(`/api/forms/${formId}/members`, { memberId: m.id, status });
      toast.success(status === "active" ? "Membre réactivé." : status === "disabled" ? "Membre désactivé — son lien n'accepte plus de réponses." : "Membre retiré de l'équipe.");
      await load();
    } catch {
      toast.error("Action impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const active = members.filter((m) => m.status === "active");
  const totalSubs = members.reduce((a, m) => a + m.submissionsCount, 0);
  // Moyenne sur les seuls membres actifs (définition homogène).
  const activeSubs = active.reduce((a, m) => a + m.submissionsCount, 0);
  const avg = active.length ? Math.round(activeSubs / active.length) : 0;
  const top5 = [...active].sort((a, b) => b.submissionsCount - a.submissionsCount).slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <button onClick={() => navigate({ name: "share", formId })} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au partage
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Équipe</h1>
        <StatusBadge status={form.status} />
      </div>
      <p className="mt-1 text-muted-foreground">{form.title} · {members.length - 1 > 0 ? `${members.length - 1} membre(s) + vous` : "vous seul pour l'instant"}</p>

      {/* Encadré statistique (C-07) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/80"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Réponses totales</p>
          <p className="font-display mt-1 text-2xl font-semibold">{totalSubs}</p>
        </CardContent></Card>
        <Card className="rounded-2xl border-border/80"><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Moyenne par membre</p>
          <p className="font-display mt-1 text-2xl font-semibold">{avg}</p>
        </CardContent></Card>
        <Card className="rounded-2xl border-border/80"><CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Top collecteurs</p>
          <div className="mt-2 space-y-1">
            {top5.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : top5.map((m, i) => (
              <p key={m.id} className="flex justify-between text-sm">
                <span className="truncate">{i + 1}. {m.firstName} {m.lastName}</span>
                <span className="font-semibold">{m.submissionsCount}</span>
              </p>
            ))}
          </div>
        </CardContent></Card>
      </div>

      {/* Tableau des membres (C-04) */}
      <Card className="mt-6 rounded-2xl border-border/80">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="divide-y divide-border/70">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {m.firstName[0]}{m.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">
                      {m.firstName} {m.lastName}
                      {m.role === "owner" && <Badge className="ml-2 bg-primary/10 text-[10px] text-primary">Initiateur</Badge>}
                      {m.status === "disabled" && <Badge variant="destructive" className="ml-2 text-[10px]">Désactivé</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                      <span className="hidden sm:inline"> · arrivé le {new Date(m.joinedAt).toLocaleDateString("fr-FR")}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{m.submissionsCount} <span className="text-xs font-normal text-muted-foreground">réponses</span></p>
                    <p className="text-[11px] text-muted-foreground">{m.last7} sur 7 jours</p>
                  </div>
                  {m.slug && m.role === "member" && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => copyLink(m)} aria-label={`Copier le lien de ${m.firstName}`}>
                      {copiedId === m.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                  {m.slug && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Voir toutes les réponses"
                      onClick={() => navigate({ name: "responses", formId, scope: "all" })}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {m.role === "member" && busyId === m.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {m.role === "member" && busyId !== m.id && (
                    <>
                      {m.status === "active" ? (
                        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setStatusMember(m, "disabled")}>
                          <Ban className="mr-1 h-3.5 w-3.5" /> Désactiver
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setStatusMember(m, "active")}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Réactiver
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive hover:text-destructive">
                            <UserMinus className="mr-1 h-3.5 w-3.5" /> Retirer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Retirer {m.firstName} de l'équipe ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Son lien cessera d'accepter des réponses (RM-08). Ses données collectées restent accessibles à l'initiateur avec la mention « Ancien membre ».
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => setStatusMember(m, "removed")}>Retirer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        Les membres rejoignent l'équipe via le lien d'invitation — voir l'écran « Partager ».
      </p>
    </div>
  );
}
