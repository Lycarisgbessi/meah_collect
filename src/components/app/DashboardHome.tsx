"use client";

// ============================================================
// DashboardHome — écran 3 (F.3) : Mes formulaires + Équipes rejointes
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import { TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { FormSummaryDTO } from "@/lib/types";
import {
  Plus, Search, PenLine, Share2, Users, BarChart3, MoreHorizontal, Pencil,
  Trash2, Copy, UserPlus, Inbox, Clock3, FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  published: { label: "Publié", className: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
  closed: { label: "Clôturé", className: "bg-amber-600/10 text-amber-700 dark:text-amber-400" },
  archived: { label: "Archivé", className: "bg-muted text-muted-foreground" },
};

export function DashboardHome() {
  const { navigate } = useAppRouter();
  const [forms, setForms] = useState<FormSummaryDTO[]>([]);
  const [joined, setJoined] = useState<FormSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FormSummaryDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ forms: FormSummaryDTO[]; joined: FormSummaryDTO[] }>("/api/forms");
      setForms(data.forms);
      setJoined(data.joined);
    } catch {
      toast.error("Impossible de charger vos formulaires.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createForm = async (templateId: string) => {
    setCreating(true);
    try {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      const res = await api.post<{ id: string }>("/api/forms", { templateId, title: templateId === "blank" ? "Nouveau formulaire" : tpl?.name });
      toast.success("Formulaire créé — à vous de jouer.");
      setTemplateOpen(false);
      navigate({ name: "builder", formId: res.id });
    } catch {
      toast.error("Création impossible. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  const duplicateForm = async (id: string) => {
    try {
      await api.post(`/api/forms/${id}/duplicate`);
      toast.success("Formulaire dupliqué en brouillon.");
      load();
    } catch {
      toast.error("Duplication impossible.");
    }
  };

  const deleteForm = async (id: string) => {
    try {
      await api.delete(`/api/forms/${id}`);
      toast.success("Formulaire supprimé.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const filtered = forms.filter(
    (f) =>
      (statusFilter === "all" || f.status === statusFilter) &&
      f.title.toLowerCase().includes(query.toLowerCase())
  );

  const totalResponses = forms.reduce((acc, f) => acc + f.submissionsCount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Bonjour 👋</h1>
          <p className="mt-1 text-muted-foreground">
            {forms.length > 0
              ? `${forms.length} formulaire(s) · ${totalResponses} réponse(s) collectée(s)`
              : "Créez votre premier formulaire en 2 minutes."}
          </p>
        </div>
        <Button size="lg" className="h-11" onClick={() => setTemplateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau formulaire
        </Button>
      </div>

      {/* Barre de recherche + filtre */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un formulaire…"
            className="h-11 pl-9"
            aria-label="Rechercher un formulaire"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-40" aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="published">Publié</SelectItem>
            <SelectItem value="closed">Clôturé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mes formulaires */}
      <section className="mt-8" aria-labelledby="my-forms">
        <h2 id="my-forms" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Mes formulaires</h2>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setTemplateOpen(true)} hasForms={forms.length > 0} />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onOpen={() => navigate({ name: "builder", formId: form.id })}
                onShare={() => navigate({ name: "share", formId: form.id })}
                onTeam={() => navigate({ name: "team", formId: form.id })}
                onResponses={() => navigate({ name: "responses", formId: form.id, scope: "all" })}
                onDuplicate={() => duplicateForm(form.id)}
                onDelete={() => setPendingDelete(form)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Équipes rejointes */}
      {joined.length > 0 && (
        <section className="mt-12" aria-labelledby="joined-teams">
          <h2 id="joined-teams" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Équipes que j'ai rejointes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {joined.map((form) => (
              <Card
                key={form.id}
                className="card-lift cursor-pointer rounded-2xl border-border/80 focus-visible:ring-2 focus-visible:ring-ring"
                role="button"
                tabIndex={0}
                aria-label={`Accéder à mon espace pour ${form.title}`}
                onClick={() => navigate({ name: "memberSpace", formId: form.id })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ name: "memberSpace", formId: form.id });
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold leading-snug">{form.title}</h3>
                    <Badge className={cn("text-[11px]", STATUS_LABELS[form.status]?.className)}>{STATUS_LABELS[form.status]?.label ?? form.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Initié par {form.ownerName}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserPlus className="h-3.5 w-3.5" /> Accéder à mon lien et à mes réponses
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Modale de création (modèles, B-07 / Q.12) */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nouveau formulaire</DialogTitle>
            <DialogDescription>Choisissez un modèle prêt à l'emploi ou partez d'une page vierge.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto p-1 sm:grid-cols-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                disabled={creating}
                onClick={() => createForm(tpl.id)}
                className="group flex items-start gap-3 rounded-xl border border-border/80 p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FilePlus2 className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{tpl.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{tpl.description}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* Confirmation de suppression */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {pendingDelete?.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible : le formulaire, ses {pendingDelete?.submissionsCount ?? 0} réponse(s) et les liens de son équipe seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) deleteForm(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormCard({
  form, onOpen, onShare, onTeam, onResponses, onDuplicate, onDelete,
}: {
  form: FormSummaryDTO;
  onOpen: () => void;
  onShare: () => void;
  onTeam: () => void;
  onResponses: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const st = STATUS_LABELS[form.status];
  return (
    <Card className="card-lift rounded-2xl border-border/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="text-left">
            <h3 className="font-display text-lg font-semibold leading-snug hover:underline">{form.title}</h3>
          </button>
          <div className="flex items-center gap-1">
            <Badge className={cn("text-[11px]", st?.className)}>{st?.label ?? form.status}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}><Pencil className="h-4 w-4" /> Modifier</DropdownMenuItem>
                <DropdownMenuItem onClick={onShare}><Share2 className="h-4 w-4" /> Partager</DropdownMenuItem>
                <DropdownMenuItem onClick={onTeam}><Users className="h-4 w-4" /> Équipe</DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4" /> Dupliquer</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /> Supprimer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Inbox className="h-3.5 w-3.5" /> {form.submissionsCount} réponse(s)</span>
          {form.todayCount > 0 && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Clock3 className="h-3.5 w-3.5" /> +{form.todayCount} aujourd'hui</span>}
          {form.membersCount > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {form.membersCount} membre(s)</span>}
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="h-9 flex-1" onClick={onResponses}>
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Réponses
          </Button>
          <Button size="sm" variant="outline" className="h-9 flex-1" onClick={form.status === "published" ? onShare : onOpen}>
            {form.status === "published" ? (
              <><Share2 className="mr-1.5 h-3.5 w-3.5" /> Partager</>
            ) : (
              <><PenLine className="mr-1.5 h-3.5 w-3.5" /> Terminer</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreate, hasForms }: { onCreate: () => void; hasForms: boolean }) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <PenLine className="h-7 w-7 text-primary" />
      </span>
      <h3 className="font-display mt-5 text-lg font-semibold">
        {hasForms ? "Aucun résultat pour cette recherche." : "Créez votre premier formulaire en 2 minutes"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasForms ? "Essayez un autre mot-clé ou un autre filtre de statut." : "Choisissez un modèle, ajoutez vos questions et partagez votre lien."}
      </p>
      {!hasForms && (
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> Créer mon formulaire
        </Button>
      )}
    </div>
  );
}
