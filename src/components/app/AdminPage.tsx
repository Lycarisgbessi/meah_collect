"use client";

// ============================================================
// AdminPage — écran 12 (Module H) : back-office plateforme
// Utilisateurs, formulaires, statistiques globales, suspensions.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import { toast } from "sonner";
import { ShieldCheck, Search, Ban, RotateCcw, Flag, PauseCircle, ArrowLeft } from "lucide-react";

interface AdminData {
  stats: { users: number; forms: number; submissions: number; suspendedUsers: number };
  users: { id: string; firstName: string; lastName: string; email: string; isSuspended: boolean; role: string; createdAt: string }[];
  forms: { id: string; title: string; status: string; ownerName: string; submissionsCount: number; membersCount: number; updatedAt: string }[];
  reports: { id: string; reason: string; formTitle: string; createdAt: string }[];
}

export function AdminPage() {
  const { navigate } = useAppRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const d = await api.get<AdminData>("/api/admin");
      setData(d);
    } catch {
      setFailed(true);
      toast.error("Accès refusé ou erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, target: { userId?: string; formId?: string; reportId?: string }, label: string) => {
    try {
      await api.post("/api/admin", { action, ...target });
      toast.success(label);
      await load();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Action impossible.");
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }
  if (failed || !data) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Le back-office n&apos;a pas pu être chargé.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}>Réessayer</Button>
          <Button variant="ghost" onClick={() => navigate({ name: "dashboard" })}>Retour à mes formulaires</Button>
        </div>
      </div>
    );
  }

  const users = data.users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const forms = data.forms.filter((f) => `${f.title} ${f.ownerName}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <button onClick={() => navigate({ name: "dashboard" })} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mon espace
      </button>

      <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        <ShieldCheck className="h-7 w-7 text-primary" /> Back-office administration
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Utilisateurs", value: data.stats.users },
          { label: "Formulaires", value: data.stats.forms },
          { label: "Soumissions", value: data.stats.submissions },
          { label: "Comptes suspendus", value: data.stats.suspendedUsers },
        ].map((s) => (
          <Card key={s.label} className="rounded-2xl border-border/80"><CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="font-display mt-1 text-2xl font-semibold">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un utilisateur ou un formulaire…" className="h-11 pl-9" />
      </div>

      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users">Utilisateurs ({users.length})</TabsTrigger>
          <TabsTrigger value="forms">Formulaires ({forms.length})</TabsTrigger>
          <TabsTrigger value="reports">Signalements ({data.reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="rounded-2xl border-border/80"><CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-44 flex-1">
                    <p className="text-sm font-medium">
                      {u.firstName} {u.lastName}
                      {u.role === "admin" && <Badge className="ml-2 bg-primary/10 text-[10px] text-primary">Admin</Badge>}
                      {u.isSuspended && <Badge variant="destructive" className="ml-2 text-[10px]">Suspendu</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email} · inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {u.isSuspended ? (
                    <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => act("reactivate_user", { userId: u.id }, "Compte réactivé.")}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Réactiver
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive hover:text-destructive" onClick={() => act("suspend_user", { userId: u.id }, "Compte suspendu.")}>
                      <Ban className="mr-1 h-3.5 w-3.5" /> Suspendre
                    </Button>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card className="rounded-2xl border-border/80"><CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {forms.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-44 flex-1">
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">Par {f.ownerName} · {f.submissionsCount} réponse(s) · {f.membersCount} membre(s)</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                  {f.status === "published" && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs text-destructive hover:text-destructive" onClick={() => act("suspend_form", { formId: f.id }, "Formulaire suspendu.")}>
                      <PauseCircle className="mr-1 h-3.5 w-3.5" /> Suspendre
                    </Button>
                  )}
                </div>
              ))}
              {forms.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun formulaire trouvé.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="rounded-2xl border-border/80"><CardContent className="p-6">
            {data.reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun signalement ouvert.</p>
            ) : (
              <div className="space-y-3">
                {data.reports.map((rp) => (
                  <div key={rp.id} className="flex items-start gap-3 rounded-xl border border-border/70 p-4">
                    <Flag className="mt-0.5 h-4 w-4 text-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{rp.formTitle}</p>
                      <p className="text-xs text-muted-foreground">{rp.reason} · {new Date(rp.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => act("resolve_report", { reportId: rp.id }, "Signalement résolu.")}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Marquer résolu
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
