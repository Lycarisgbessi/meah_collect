"use client";

// ============================================================
// ResponsesDashboard — écran 9 (F-01..F-16) : tableau de bord des réponses
// ------------------------------------------------------------
// Scope « mine » : un membre voit SES réponses uniquement (RM-05).
// Scope « all »  : l’initiateur voit tout (RM-06) + colonne « Collecté
//                  par », filtre membre et suppression unitaire.
// Perf : re-fetch uniquement sur changement de filtre / pagination ;
//        tri (page courante) et sélection restent en état local.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Flag,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import type { FormFieldDef, StatsDTO, SubmissionRowDTO } from "@/lib/types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ---------- Constantes ----------

const PAGE_SIZE = 50;
const ALL = "__all"; // sentinelle Radix Select (valeur vide interdite)
const BULK_NONE = "__bulk_none";
const CONTENT_BLOCK_TYPES = [
  "section_title",
  "paragraph_text",
  "image_block",
  "callout",
  "divider",
  "page_break",
  "welcome_screen",
  "end_screen",
];

type Period = "7" | "30" | "all" | "custom";

const STATUS_OPTIONS = [
  { value: "new", label: "Nouveau" },
  { value: "contacted", label: "Contacté" },
  { value: "qualified", label: "Qualifié" },
  { value: "converted", label: "Converti" },
  { value: "lost", label: "Perdu" },
] as const;

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "Nouveau", className: "border-border bg-muted text-muted-foreground" },
  contacted: { label: "Contacté", className: "border-gold/30 bg-gold/10 text-gold" },
  qualified: { label: "Qualifié", className: "border-chart-2/30 bg-chart-2/10 text-chart-2" },
  converted: { label: "Converti", className: "border-success/30 bg-success/10 text-success" },
  lost: { label: "Perdu", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

interface ListResponse {
  rows: SubmissionRowDTO[];
  total: number;
  offset: number;
  limit: number;
  columns: FormFieldDef[];
  scope: "mine" | "all";
  members?: { id: string; name: string }[];
  formTitle: string;
}

// ---------- Helpers ----------

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Une erreur est survenue. Réessayez.";
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDatePart(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTimePart(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDayParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDuration(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return r > 0 ? `${m} min ${r} s` : `${m} min`;
}

// ---------- Petits composants internes ----------

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        meta?.className ?? "border-border bg-muted text-muted-foreground"
      }`}
    >
      {meta?.label ?? status}
    </span>
  );
}

function FlaggedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      <Flag className="h-3 w-3" />
      Signalée
    </span>
  );
}

function SortHead({
  label,
  sortKey,
  activeSortKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Trier par ${label}`}
        className="group inline-flex max-w-full items-center gap-1 transition-colors hover:text-foreground"
      >
        <span className="truncate">{label}</span>
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gold" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gold" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        )}
      </button>
    </TableHead>
  );
}

function MobileRowCard({
  row,
  fields,
  showCollector,
  isSelected,
  onToggle,
  onOpen,
}: {
  row: SubmissionRowDTO;
  fields: FormFieldDef[];
  showCollector: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer p-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{showCollector ? row.memberName : "Réponse"}</p>
            {row.isFlagged && <FlaggedBadge />}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {fmtDateTime(row.submittedAt)} · {fmtDuration(row.durationSec)}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center pt-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            aria-label={`Sélectionner la réponse du ${fmtDateTime(row.submittedAt)}`}
          />
        </div>
      </div>
      <dl className="mt-3 space-y-1.5">
        {fields.slice(0, 3).map((f) => (
          <div key={f.key} className="flex items-baseline gap-3 text-sm">
            <dt className="w-28 shrink-0 truncate text-xs text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 flex-1 truncate">{row.values[f.key] || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <StatusBadge status={row.leadStatus} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-60 rounded-2xl" />
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

// ---------- Composant principal ----------

export function ResponsesDashboard({ formId, scope }: { formId: string; scope: "mine" | "all" }) {
  const { navigate } = useAppRouter();

  // Données
  const [data, setData] = useState<ListResponse | null>(null);
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres serveur (F-02 / F-03)
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState("");
  const [memberId, setMemberId] = useState("");

  // Pagination
  const [offset, setOffset] = useState(0);

  // Tri + sélection — état local, jamais envoyés au serveur
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState(BULK_NONE);

  // Panneau détail (F-06)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Exports (F-11..F-16)
  const [exporting, setExporting] = useState<string | null>(null);

  // Portée effective : l’API renvoie « mine » si l’utilisateur n’est pas initiateur
  const effScope = data?.scope ?? scope;

  // Période effective → paramètres from/to
  const effFrom =
    period === "all"
      ? ""
      : period === "custom"
        ? customFrom
        : fmtDayParam(new Date(Date.now() - (period === "7" ? 6 : 29) * 86_400_000));
  const effTo = period === "all" ? "" : period === "custom" ? customTo : fmtDayParam(new Date());

  const hasFilters = Boolean(q || status || memberId || effFrom || effTo);

  // ---------- Chargements (uniquement filtres / pagination / manuel) ----------

  // Garde d'ordre : une réponse lente (ancienne requête) ne doit jamais écraser une plus récente.
  const listSeqRef = useRef(0);

  const loadList = useCallback(async () => {
    const seq = ++listSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ scope, limit: String(PAGE_SIZE), offset: String(offset) });
      if (q) sp.set("q", q);
      if (effFrom) sp.set("from", effFrom);
      if (effTo) sp.set("to", effTo);
      if (status) sp.set("status", status);
      if (memberId) sp.set("member_id", memberId);
      const list = await api.get<ListResponse>(`/api/forms/${formId}/submissions?${sp.toString()}`);
      if (seq !== listSeqRef.current) return; // une requête plus récente a répondu
      setData(list);
      setSelected(new Set());
      setBulkStatus(BULK_NONE);
    } catch (err) {
      if (seq !== listSeqRef.current) return;
      setError(errMsg(err));
    } finally {
      if (seq === listSeqRef.current) setLoading(false);
    }
  }, [formId, scope, q, effFrom, effTo, status, memberId, offset]);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<StatsDTO>(`/api/forms/${formId}/stats`);
      setStats(s);
    } catch {
      /* les KPI ne bloquent pas la liste */
    }
  }, [formId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Recherche plein texte — debounce 300 ms (F-02)
  useEffect(() => {
    const t = setTimeout(() => {
      const next = qInput.trim();
      setQ((prev) => (prev === next ? prev : next));
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const refresh = useCallback(() => {
    void loadList();
    void loadStats();
  }, [loadList, loadStats]);

  // ---------- Champs ----------

  const columns = useMemo(
    () => (data?.columns ?? []).filter((f) => !CONTENT_BLOCK_TYPES.includes(f.type)),
    [data],
  );
  const visibleColumns = useMemo(() => columns.slice(0, 6), [columns]);

  // ---------- Tri local (page courante) ----------

  const sortedRows = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "date") {
        av = a.submittedAt;
        bv = b.submittedAt;
      } else if (sortKey === "member") {
        av = a.memberName;
        bv = b.memberName;
      } else if (sortKey === "flag") {
        av = a.isFlagged ? 1 : 0;
        bv = b.isFlagged ? 1 : 0;
      } else {
        av = a.values[sortKey] ?? "";
        bv = b.values[sortKey] ?? "";
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "fr", { numeric: true }) * dir;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  // ---------- Sélection (F.8 actions groupées) ----------

  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(r.id));
  const someSelected = sortedRows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) sortedRows.forEach((r) => next.delete(r.id));
      else sortedRows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---------- Mutations (mises à jour locales, sans re-fetch complet) ----------

  const patchLocalRow = (id: string, patch: Partial<SubmissionRowDTO>) => {
    setData((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : prev,
    );
  };

  const saveStatus = async (id: string, leadStatus: string) => {
    setSavingStatus(true);
    try {
      await api.patch(`/api/submissions/${id}`, { leadStatus });
      patchLocalRow(id, { leadStatus });
      toast.success(`Statut mis à jour : ${STATUS_META[leadStatus]?.label ?? leadStatus}`);
      void loadStats();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const saveNote = async () => {
    if (!detailRow) return;
    setSavingNote(true);
    try {
      await api.patch(`/api/submissions/${detailRow.id}`, { internalNote: noteDraft });
      patchLocalRow(detailRow.id, { internalNote: noteDraft });
      toast.success("Note interne enregistrée.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingNote(false);
    }
  };

  const deleteRow = async () => {
    if (!detailRow) return;
    setDeleting(true);
    try {
      await api.delete(`/api/submissions/${detailRow.id}`);
      const delId = detailRow.id;
      // Correction de pagination calculée HORS updater (les updaters doivent rester purs)
      const remaining = (data?.rows ?? []).filter((r) => r.id !== delId);
      if (remaining.length === 0 && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
      } else {
        setData((prev) => {
          if (!prev) return prev;
          const rows = prev.rows.filter((r) => r.id !== delId);
          return { ...prev, rows, total: Math.max(0, prev.total - 1) };
        });
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(delId);
        return next;
      });
      setDetailId(null);
      toast.success("Réponse supprimée.");
      void loadStats();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  const applyBulkStatus = async (leadStatus: string) => {
    const ids = [...selected];
    if (!ids.length || !leadStatus) return;
    try {
      await api.patch(`/api/forms/${formId}/submissions`, { ids, leadStatus });
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) => (selected.has(r.id) ? { ...r, leadStatus } : r)),
            }
          : prev,
      );
      setSelected(new Set());
      setBulkStatus(BULK_NONE);
      toast.success(`${ids.length} réponse${ids.length > 1 ? "s" : ""} mise${ids.length > 1 ? "s" : ""} à jour.`);
      void loadStats();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  // ---------- Exports (F-11..F-16) ----------

  const runExport = async (format: "xlsx" | "pdf" | "csv") => {
    setExporting(format);
    try {
      const res = await api.post<{
        status: "ready" | "queued";
        download_url?: string;
        row_count?: number;
      }>(`/api/forms/${formId}/exports`, {
        format,
        filters: {
          scope: effScope,
          from: effFrom || undefined,
          to: effTo || undefined,
          member_id: memberId || undefined,
          status: status || undefined,
          q: q || undefined,
        },
      });
      if (res.status === "queued") {
        toast.info("Export volumineux en préparation — vous serez notifié.");
      } else if (res.download_url) {
        window.location.href = res.download_url;
        toast.success(
          `Export ${format.toUpperCase()} prêt${res.row_count != null ? ` (${res.row_count} lignes)` : ""} — téléchargement lancé.`,
        );
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setExporting(null);
    }
  };

  // ---------- Panneau détail ----------

  const detailRow = data?.rows.find((r) => r.id === detailId) ?? null;

  const openDetail = (row: SubmissionRowDTO) => {
    setDetailId(row.id);
    setNoteDraft(row.internalNote ?? "");
  };

  // ---------- Pagination ----------

  const total = data?.total ?? 0;
  const pageSize = data?.limit ?? PAGE_SIZE;
  const canPrev = offset > 0;
  const canNext = offset + sortedRows.length < total;
  const rangeLabel =
    total === 0
      ? "0 résultat"
      : `${offset + 1}–${Math.min(offset + sortedRows.length, total)} sur ${total}`;

  // ---------- Données graphiques (F-05 / F-10) ----------

  const evolution = useMemo(
    () =>
      (stats?.evolution ?? []).map((p) => ({
        count: p.count,
        label: new Date(`${p.date}T00:00:00`).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
      })),
    [stats],
  );
  const evolutionTotal = evolution.reduce((a, p) => a + p.count, 0);

  const memberRows = useMemo(() => {
    const list = effScope === "all" ? (stats?.byMember ?? []) : [];
    return list.map((m) => {
      const totalMember = list.reduce((a, x) => a + x.count, 0);
      return { ...m, pct: totalMember > 0 ? Math.round((m.count / totalMember) * 100) : 0 };
    });
  }, [stats, effScope]);

  // ---------- États d’erreur / chargement initial ----------

  if (!data) {
    if (loading) return <DashboardSkeleton />;
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <Inbox className="h-6 w-6 text-destructive" />
            </div>
            <p className="font-display mt-4 text-lg font-semibold">Impossible de charger les réponses</p>
            <p className="mt-2 text-sm text-muted-foreground">{error ?? "Une erreur est survenue. Réessayez."}</p>
            <Button className="mt-6 rounded-xl" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const members = data.members ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* ---------- En-tête (F-01) ---------- */}
      <button
        type="button"
        onClick={() => navigate({ name: "dashboard" })}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mon espace
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.formTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {effScope === "mine" ? "Mes réponses uniquement" : "Toutes les réponses · vue initiateur"}
            {" · "}
            {total} réponse{total > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl" disabled={!!exporting || total === 0}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuLabel>Choisir le format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void runExport("xlsx")} disabled={!!exporting}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-gold" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runExport("pdf")} disabled={!!exporting}>
                <FileText className="mr-2 h-4 w-4 text-gold" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runExport("csv")} disabled={!!exporting}>
                <FileDown className="mr-2 h-4 w-4 text-gold" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={refresh}
            disabled={loading}
            aria-label="Actualiser les réponses"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* ---------- Cartes KPI (F-04) ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: stats?.total ?? data.total },
          { label: "Aujourd’hui", value: stats?.today ?? 0 },
          { label: "7 jours", value: stats?.last7 ?? 0 },
          { label: "30 jours", value: stats?.last30 ?? 0 },
        ].map((k) => (
          <Card key={k.label} className="card-lift rounded-2xl border-border/70">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="font-display mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- Graphiques (F-05 + F-10 en vue initiateur) ---------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border-border/70 xl:col-span-2">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold">Évolution des réponses</h2>
                <p className="text-xs text-muted-foreground">30 derniers jours</p>
              </div>
              <Badge variant="outline" className="rounded-full border-gold/40 text-gold">
                {evolutionTotal} sur 30 j
              </Badge>
            </div>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evolutionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B08D57" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#B08D57" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(176,141,87,0.18)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={22}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={38}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "#B08D57", strokeOpacity: 0.3 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--popover-foreground)", fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Réponses"
                    stroke="#B08D57"
                    strokeWidth={2}
                    fill="url(#evolutionFill)"
                    activeDot={{ r: 4, fill: "#B08D57", stroke: "var(--card)", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {effScope === "all" && memberRows.length > 0 && (
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Répartition par membre</h2>
              <p className="text-xs text-muted-foreground">Collectes par membre de l’équipe</p>
              <div className="mt-4 space-y-3.5">
                {memberRows.slice(0, 8).map((m) => (
                  <div key={m.memberId}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{m.name}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {m.count} · {m.pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="gold-gradient h-full rounded-full"
                        style={{ width: `${Math.max(3, m.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {memberRows.length > 8 && (
                  <p className="text-xs text-muted-foreground">+ {memberRows.length - 8} autres membres</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---------- Barre d’outils (F-02 / F-03) ---------- */}
      <Card className="mt-4 rounded-2xl border-border/70">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Rechercher dans les réponses…"
                aria-label="Rechercher dans les réponses"
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setOffset(0); }}>
              <SelectTrigger className="h-10 w-[172px] rounded-xl" aria-label="Filtrer par période">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Toute la période</SelectItem>
                <SelectItem value="7">7 derniers jours</SelectItem>
                <SelectItem value="30">30 derniers jours</SelectItem>
                <SelectItem value="custom">Personnalisé…</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? "" : v); setOffset(0); }}>
              <SelectTrigger className="h-10 w-[150px] rounded-xl" aria-label="Filtrer par statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL}>Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {effScope === "all" && members.length > 0 && (
              <Select
                value={memberId || ALL}
                onValueChange={(v) => { setMemberId(v === ALL ? "" : v); setOffset(0); }}
              >
                <SelectTrigger className="h-10 w-[172px] rounded-xl" aria-label="Filtrer par membre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={ALL}>Tous les membres</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => {
                  setQInput("");
                  setQ("");
                  setPeriod("all");
                  setCustomFrom("");
                  setCustomTo("");
                  setStatus("");
                  setMemberId("");
                  setOffset(0);
                }}
                aria-label="Réinitialiser les filtres"
                title="Réinitialiser les filtres"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {period === "custom" && (
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3">
              <div className="space-y-1">
                <Label htmlFor="resp-from" className="text-xs text-muted-foreground">
                  Du
                </Label>
                <Input
                  id="resp-from"
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setOffset(0);
                  }}
                  className="h-10 w-44 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resp-to" className="text-xs text-muted-foreground">
                  Au
                </Label>
                <Input
                  id="resp-to"
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setOffset(0);
                  }}
                  className="h-10 w-44 rounded-xl"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Barre d’actions groupées (F.8) ---------- */}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/30 bg-gold/5 p-3">
          <span className="text-sm font-medium">
            {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <Select
            value={bulkStatus}
            onValueChange={(v) => {
              setBulkStatus(v);
              if (v !== BULK_NONE) void applyBulkStatus(v);
            }}
          >
            <SelectTrigger
              className="h-9 w-[200px] rounded-xl bg-background"
              aria-label="Changer le statut des réponses sélectionnées"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={BULK_NONE} disabled>
                Changer le statut…
              </SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setSelected(new Set())}>
            <X className="mr-1.5 h-4 w-4" />
            Désélectionner
          </Button>
        </div>
      )}

      {/* ---------- Tableau (F-01) + cartes mobiles + pagination ---------- */}
      <Card className="mt-4 rounded-2xl border-border/70">
        <CardContent className="p-0">
          {sortedRows.length === 0 ? (
            loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (
              /* ---------- État vide ---------- */
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
                  <Inbox className="h-8 w-8 text-gold" />
                </div>
                {hasFilters ? (
                  <>
                    <p className="font-display mt-4 text-lg font-semibold">
                      Aucune réponse ne correspond à vos filtres.
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Élargissez la recherche, la période ou le statut pour voir davantage de résultats.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6 rounded-xl"
                      onClick={() => {
                        setQInput("");
                        setQ("");
                        setPeriod("all");
                        setCustomFrom("");
                        setCustomTo("");
                        setStatus("");
                        setMemberId("");
                        setOffset(0);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Réinitialiser les filtres
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-display mt-4 text-lg font-semibold">Aucune réponse pour l’instant.</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Partagez votre lien pour commencer à collecter des réponses.
                    </p>
                    <Button
                      className="mt-6 rounded-xl"
                      onClick={() =>
                        navigate({ name: scope === "mine" ? "memberSpace" : "share", formId })
                      }
                    >
                      Obtenir mon lien
                    </Button>
                  </>
                )}
              </div>
            )
          ) : (
            <>
              {/* Tableau — desktop (≥ md) */}
              <div
                className={`hidden max-h-[60vh] overflow-auto md:block [&_[data-slot=table]]:min-w-[860px] [&_[data-slot=table-container]]:overflow-visible ${
                  loading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Table>
                  <TableHeader className="sticky top-0 z-10 rounded-t-2xl bg-card">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={toggleAll}
                          aria-label="Tout sélectionner sur cette page"
                        />
                      </TableHead>
                      <SortHead
                        label="Date"
                        sortKey="date"
                        activeSortKey={sortKey}
                        dir={sortDir}
                        onSort={toggleSort}
                        className="min-w-[110px]"
                      />
                      {effScope === "all" && (
                        <SortHead
                          label="Collecté par"
                          sortKey="member"
                          activeSortKey={sortKey}
                          dir={sortDir}
                          onSort={toggleSort}
                          className="min-w-[140px]"
                        />
                      )}
                      <SortHead
                        label="Signalée"
                        sortKey="flag"
                        activeSortKey={sortKey}
                        dir={sortDir}
                        onSort={toggleSort}
                        className="min-w-[90px]"
                      />
                      {visibleColumns.map((f) => (
                        <SortHead
                          key={f.key}
                          label={f.label}
                          sortKey={f.key}
                          activeSortKey={sortKey}
                          dir={sortDir}
                          onSort={toggleSort}
                          className="min-w-[140px]"
                        />
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => (
                      <TableRow
                        key={row.id}
                        onClick={() => openDetail(row)}
                        className="cursor-pointer"
                        data-state={selected.has(row.id) ? "selected" : undefined}
                      >
                        <TableCell
                          className="py-3 pl-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected.has(row.id)}
                            onCheckedChange={() => toggleOne(row.id)}
                            aria-label={`Sélectionner la réponse du ${fmtDateTime(row.submittedAt)}`}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="whitespace-nowrap text-sm font-medium">
                            {fmtDatePart(row.submittedAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtTimePart(row.submittedAt)}</div>
                        </TableCell>
                        {effScope === "all" && (
                          <TableCell className="py-3 text-sm">{row.memberName || "—"}</TableCell>
                        )}
                        <TableCell className="py-3">
                          {row.isFlagged ? <FlaggedBadge /> : <span className="text-sm text-muted-foreground">—</span>}
                        </TableCell>
                        {visibleColumns.map((f) => (
                          <TableCell key={f.key} className="max-w-52 py-3 text-sm">
                            <span className="block truncate" title={row.values[f.key] || undefined}>
                              {row.values[f.key] || "—"}
                            </span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cartes empilées — mobile (< md) */}
              <div
                className={`divide-y divide-border/60 md:hidden ${
                  loading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {sortedRows.map((row) => (
                  <MobileRowCard
                    key={row.id}
                    row={row}
                    fields={visibleColumns}
                    showCollector={effScope === "all"}
                    isSelected={selected.has(row.id)}
                    onToggle={() => toggleOne(row.id)}
                    onOpen={() => openDetail(row)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground sm:text-sm">{rangeLabel}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={!canPrev || loading}
                    onClick={() => setOffset(Math.max(0, offset - pageSize))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={!canNext || loading}
                    onClick={() => setOffset(offset + pageSize)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Panneau détail (F-06) ---------- */}
      <Sheet open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto rounded-l-2xl border-border/70 p-0 sm:max-w-lg"
        >
          {detailRow && (
            <>
              <SheetHeader className="border-b border-border/70 px-5 py-4 pr-12 text-left">
                <SheetTitle className="font-display text-xl">Détail de la réponse</SheetTitle>
                <SheetDescription>
                  Collectée le {fmtDateTime(detailRow.submittedAt)}
                  {effScope === "all" ? ` par ${detailRow.memberName}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 px-5 py-5">
                {/* Métadonnées */}
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</dt>
                      <dd className="mt-0.5 font-medium">{fmtDatePart(detailRow.submittedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Heure</dt>
                      <dd className="mt-0.5 font-medium">{fmtTimePart(detailRow.submittedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Durée</dt>
                      <dd className="mt-0.5 flex items-center gap-1 font-medium">
                        <Clock className="h-3.5 w-3.5 text-gold" />
                        {fmtDuration(detailRow.durationSec)}
                      </dd>
                    </div>
                    {effScope === "all" && (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Collecté par
                        </dt>
                        <dd className="mt-0.5 font-medium">{detailRow.memberName}</dd>
                      </div>
                    )}
                    <div className="col-span-2 sm:col-span-2">
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Statut actuel
                      </dt>
                      <dd className="mt-0.5">
                        <StatusBadge status={detailRow.leadStatus} />
                      </dd>
                    </div>
                  </dl>
                  {detailRow.isFlagged && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <FlaggedBadge />
                    </div>
                  )}
                </div>

                {/* Statut + note interne (F-07/F-08) */}
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Statut du lead
                  </Label>
                  <Select
                    value={detailRow.leadStatus}
                    onValueChange={(v) => void saveStatus(detailRow.id, v)}
                    disabled={savingStatus}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Changer le statut du lead">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resp-note" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Note interne
                  </Label>
                  <Textarea
                    id="resp-note"
                    rows={4}
                    placeholder="Contacté…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={savingNote || noteDraft === (detailRow.internalNote ?? "")}
                      onClick={() => void saveNote()}
                    >
                      {savingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enregistrer la note
                    </Button>
                  </div>
                </div>

                {/* Toutes les valeurs */}
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Réponses au formulaire
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-border/60">
                    {columns.map((f, i) => (
                      <div
                        key={f.key}
                        className={`px-4 py-3 ${i > 0 ? "border-t border-border/60" : ""}`}
                      >
                        <p className="text-xs text-muted-foreground">{f.label}</p>
                        <p className="mt-1 text-sm font-medium break-words whitespace-pre-wrap">
                          {detailRow.values[f.key] || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Suppression — initiateur uniquement */}
              {effScope === "all" && (
                <div className="border-t border-border/70 px-5 py-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={deleting}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer la réponse
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer définitivement cette réponse ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. La réponse sera retirée du tableau de bord et des
                          prochains exports.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className={buttonVariants({ variant: "destructive" })}
                          onClick={() => void deleteRow()}
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
