"use client";

// ============================================================
// FormBuilder — écran 4 (F.4) + Annexe Q.11 : constructeur complet
// Bibliothèque de champs (Q.3) avec recherche, jeux de réponses
// prêts à l'emploi (Q.4), canevas trié par glisser-déposer (@dnd-kit),
// panneau de propriétés à onglets (Champ / Design / Paramètres),
// aperçu en direct bureau/mobile (B-05), sauvegarde automatique
// 1,5 s (B-06), Ctrl/Cmd+S (Q-16), publication avec checklist (B.1).
// ============================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FormRenderer } from "@/components/form-renderer/FormRenderer";
import { ApiError, api } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import {
  ANSWER_SETS,
  CONTENT_TYPES,
  COUNTRIES,
  FAMILY_LABELS,
  FIELD_CATALOG,
  LIKERT_LABELS,
  QUESTION_TYPES,
  createDefaultField,
  generateFieldKey,
  type CatalogEntry,
  type FieldFamily,
} from "@/lib/fields";
import type {
  ChoiceOption,
  FieldOptions,
  FieldType,
  FormFieldDef,
  FormSettings,
  FormStatus,
  FormTheme,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlignLeft,
  ArrowLeft,
  AlertCircle,
  Banknote,
  Briefcase,
  Building2,
  Cake,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  CircleHelp,
  ClipboardPaste,
  Clock,
  Copy,
  DoorOpen,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  Globe2,
  GripVertical,
  Hash,
  Heading2,
  IdCard,
  ImageIcon,
  Info,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Monitor,
  MoreVertical,
  Palette,
  Phone,
  Pilcrow,
  Plus,
  Save,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Smile,
  Star,
  ToggleLeft,
  Trash2,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";

// ============================================================
// Constantes
// ============================================================

const MAX_FIELDS = 100; // garde-fou Q.11
const MAX_CHOICES = 100;
const DEBOUNCE_MS = 1500; // B-06

/** Mapping dynamique nom d'icône du catalogue → composant lucide (fallback CircleDot) */
const ICONS: Record<string, LucideIcon> = {
  Type,
  AlignLeft,
  User,
  IdCard,
  Mail,
  Phone,
  Link2,
  Building2,
  Briefcase,
  MapPin,
  Globe2,
  EyeOff,
  CircleDot,
  ListChecks,
  ChevronDown,
  ToggleLeft,
  CircleHelp,
  Check,
  ShieldCheck,
  Star,
  Hash,
  Gauge,
  Smile,
  Banknote,
  CalendarDays,
  Cake,
  Clock,
  Heading2,
  Paragraph: Pilcrow,
  ImageIcon,
  Info,
  Minus,
  Scissors,
  DoorOpen,
  Flag,
};

const QUESTION_FAMILIES: FieldFamily[] = ["identity", "choice", "scale", "number_date"];

const STATUS_LABELS: Record<FormStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  closed: "Clôturé",
  archived: "Archivé",
};

const ACCENT_PRESETS: { color: string; name: string }[] = [
  { color: "#B08D57", name: "Or champagne" },
  { color: "#8A5A44", name: "Bronze" },
  { color: "#6B705C", name: "Olive" },
  { color: "#3E5641", name: "Vert forêt" },
  { color: "#7C3A45", name: "Bordeaux" },
  { color: "#211D17", name: "Encre" },
];

const PLACEHOLDER_TYPES: FieldType[] = [
  "short_text", "long_text", "first_name", "last_name", "full_name", "email",
  "phone", "url", "company", "job_title", "city", "integer", "decimal",
  "date", "birthdate", "time",
];

const LENGTH_TYPES: FieldType[] = [
  "short_text", "long_text", "first_name", "last_name", "full_name", "company", "job_title", "city",
];

const NUMBER_TYPES: FieldType[] = ["integer", "decimal"];

const LAYOUT_TYPES: FieldType[] = [
  "single_choice", "multiple_choice", "dropdown",
  "yes_no", "yes_no_unknown", "true_false", "true_false_unknown",
];

const CONTENT_TEXT_TYPES: FieldType[] = [
  "paragraph_text", "callout", "section_title", "welcome_screen", "end_screen",
];

const SCALE_LABEL_TYPES: FieldType[] = ["number_scale", "nps"];

const ANSWER_SET_CATEGORIES: string[] = Array.from(new Set(ANSWER_SETS.map((s) => s.category)));

interface FormDetailResponse {
  id: string;
  title: string;
  description?: string | null;
  status: FormStatus;
  displayMode: string;
  theme: FormTheme;
  settings: FormSettings;
  fields: FormFieldDef[];
  versionNumber?: number;
  myRole?: string;
  myLink?: string;
  ownerName?: string;
}

function parseNumber(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function clampInt(v: number | undefined, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  return Math.min(max, Math.max(min, Math.round(v)));
}

// ============================================================
// Composant principal
// ============================================================

export function FormBuilder({ formId }: { formId: string }) {
  const { navigate } = useAppRouter();

  // ----- Données du formulaire -----
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<FormStatus>("draft");
  const [displayMode, setDisplayMode] = useState("single_page");
  const [theme, setTheme] = useState<FormTheme>({});
  const [settings, setSettings] = useState<FormSettings>({});

  // ----- États d'interface -----
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [search, setSearch] = useState("");
  const [publishIssues, setPublishIssues] = useState<string[] | null>(null);

  // ----- Machine de sauvegarde (B-06 / Q-16) -----
  // pendingRef = source de vérité des modifications en attente (immunité aux courses) ;
  // pendingVersion déclenche l'effet de debounce à chaque modification.
  const pendingRef = useRef<{ fields: boolean; meta: boolean }>({ fields: false, meta: false });
  const [pendingVersion, setPendingVersion] = useState(0);
  const fieldsRef = useRef<FormFieldDef[]>([]);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const markDirty = useCallback((kind: "fields" | "meta") => {
    pendingRef.current[kind] = true;
    setDirty(true);
    setPendingVersion((v) => v + 1);
  }, []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    const wantFields = pendingRef.current.fields;
    const wantMeta = pendingRef.current.meta;
    if (!wantFields && !wantMeta) return true;
    pendingRef.current.fields = false;
    pendingRef.current.meta = false;
    setSaving(true);

    const tasks: Promise<void>[] = [];
    if (wantFields) {
      tasks.push(
        api
          .put<{ ok: boolean; newVersion?: boolean }>(`/api/forms/${formId}`, { fields: fieldsRef.current })
          .then((res) => {
            if (res?.newVersion) {
              toast.info("Nouvelle version créée — les anciennes réponses restent intactes (RM-07).");
            }
          })
          .catch((err: unknown) => {
            pendingRef.current.fields = true; // retenté au prochain passage
            toast.error(err instanceof Error ? err.message : "Enregistrement des champs impossible.");
          })
      );
    }
    if (wantMeta) {
      tasks.push(
        api
          .patch<void>(`/api/forms/${formId}`, { title, description: undefined, theme, settings, displayMode })
          .catch((err: unknown) => {
            pendingRef.current.meta = true;
            toast.error(err instanceof Error ? err.message : "Enregistrement des réglages impossible.");
          })
      );
    }
    await Promise.all(tasks);
    setSaving(false);
    const stillPending = pendingRef.current.fields || pendingRef.current.meta;
    if (stillPending) {
      setPendingVersion((v) => v + 1); // ré-arme le debounce pour les éléments en échec
      return false;
    }
    setLastSavedAt(new Date());
    setDirty(false);
    return true;
  }, [formId, title, theme, settings, displayMode]);

  // Sauvegarde automatique — 1,5 s après la dernière modification (B-06)
  useEffect(() => {
    if (!pendingRef.current.fields && !pendingRef.current.meta) return;
    const t = setTimeout(() => {
      void saveNow();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [pendingVersion, saveNow]);

  // Ctrl/Cmd+S (Q-16)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  // Garde-fou : quitter la page avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Référence toujours à jour de saveNow (pour le flush au démontage)
  const saveNowRef = useRef(saveNow);
  useEffect(() => { saveNowRef.current = saveNow; }, [saveNow]);

  // Flush au démontage : une navigation interne (logo, menu, back) ne perd plus
  // les modifications de moins de 1,5 s non encore sauvegardées.
  useEffect(() => {
    return () => {
      if (pendingRef.current.fields || pendingRef.current.meta) {
        void saveNowRef.current();
      }
    };
  }, []);

  // ----- Chargement initial -----
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const f = await api.get<FormDetailResponse>(`/api/forms/${formId}`);
        if (!alive) return;
        // RM-01 : seul l'initiateur peut modifier — un membre est renvoyé vers son espace.
        if (f.myRole === "member") {
          toast.info("Seul l'initiateur peut modifier ce formulaire.");
          navigate({ name: "memberSpace", formId }, { replace: true });
          return;
        }
        setFields([...(f.fields ?? [])].sort((a, b) => a.position - b.position));
        setTitle(f.title ?? "");
        setStatus(f.status ?? "draft");
        setDisplayMode(f.displayMode ?? "single_page");
        setTheme(f.theme ?? {});
        setSettings(f.settings ?? {});
        setLastSavedAt(null);
        setDirty(false);
        pendingRef.current = { fields: false, meta: false };
      } catch (err) {
        if (alive) {
          toast.error(err instanceof Error ? err.message : "Impossible de charger le formulaire.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [formId, navigate]);

  // ----- Sélection -----
  const selected = fields.find((f) => f.key === selectedKey) ?? null;
  const selectedEntry = selected ? FIELD_CATALOG[selected.type] : null;
  const selectedHasChoices = Boolean(selectedEntry?.hasChoices);

  // ----- Opérations sur les champs -----
  const guardMaxFields = (): boolean => {
    if (fieldsRef.current.length >= MAX_FIELDS) {
      toast.warning(`Limite de ${MAX_FIELDS} blocs atteinte — supprimez un élément pour continuer (Q.11).`);
      return false;
    }
    return true;
  };

  const addField = (type: FieldType) => {
    if (!guardMaxFields()) return;
    const prev = fieldsRef.current;
    const field = createDefaultField(type, prev.length, prev.map((x) => x.key));
    setFields([...prev, field]);
    setSelectedKey(field.key);
    markDirty("fields");
  };

  const updateField = (key: string, patch: Partial<FormFieldDef>) => {
    setFields(fieldsRef.current.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    markDirty("fields");
  };

  const patchOptions = (key: string, patch: Partial<FieldOptions>) => {
    const f = fieldsRef.current.find((x) => x.key === key);
    if (!f) return;
    updateField(key, { options: { ...f.options, ...patch } });
  };

  const removeField = (key: string) => {
    const next = fieldsRef.current
      .filter((f) => f.key !== key)
      .map((f, i) => ({ ...f, position: i }));
    setFields(next);
    if (selectedKey === key) setSelectedKey(null);
    markDirty("fields");
  };

  const duplicateField = (key: string) => {
    if (!guardMaxFields()) return;
    const prev = fieldsRef.current;
    const idx = prev.findIndex((f) => f.key === key);
    if (idx < 0) return;
    const clone = JSON.parse(JSON.stringify(prev[idx])) as FormFieldDef;
    const copy: FormFieldDef = {
      ...clone,
      id: undefined,
      key: generateFieldKey(prev[idx].type, prev.map((x) => x.key)),
      label: `${prev[idx].label} (copie)`,
    };
    setFields([...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)].map((f, i) => ({ ...f, position: i })));
    setSelectedKey(copy.key);
    markDirty("fields");
    toast.success("Champ dupliqué — pensez à adapter son libellé.");
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const prev = fieldsRef.current;
    const oldIdx = prev.findIndex((f) => f.key === active.id);
    const newIdx = prev.findIndex((f) => f.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    // Les clés (f.key) restent stables — seules les positions sont recalculées.
    setFields(arrayMove(prev, oldIdx, newIdx).map((f, i) => ({ ...f, position: i })));
    markDirty("fields");
  };

  // ----- Réglages (meta) -----
  const patchTheme = (patch: Partial<FormTheme>) => {
    setTheme((t) => ({ ...t, ...patch }));
    markDirty("meta");
  };
  const patchSettings = (patch: Partial<FormSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    markDirty("meta");
  };
  const patchDisplayMode = (v: string) => {
    setDisplayMode(v);
    markDirty("meta");
  };
  const flushPending = () => {
    if (pendingRef.current.fields || pendingRef.current.meta) void saveNow();
  };

  // ----- Jeux de réponses (Q.4) -----
  const applyAnswerSet = (set: (typeof ANSWER_SETS)[number]) => {
    if (!selected) return;
    patchOptions(selected.key, { choices: JSON.parse(JSON.stringify(set.choices)) as ChoiceOption[] });
    toast.success(`Jeu « ${set.name} » appliqué à « ${selected.label} ».`);
  };

  // ----- Publication (B.1) -----
  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const saved = await saveNow();
      if (!saved) {
        toast.error("Enregistrez vos modifications avant de publier.");
        return;
      }
      await api.post<{ ok: boolean }>(`/api/forms/${formId}/publish`, { action: "publish" });
      toast.success("Formulaire publié — vos liens de collecte sont prêts.");
      setStatus("published");
      navigate({ name: "share", formId });
    } catch (err) {
      if (err instanceof ApiError && err.code === "PUBLICATION_CHECK") {
        const raw = err.fields as unknown as { issues?: string[] } | undefined;
        const issues = Array.isArray(raw?.issues) && raw.issues.length > 0
          ? raw.issues
          : [err.message || "Le formulaire ne remplit pas encore les conditions de publication."];
        setPublishIssues(issues);
      } else {
        toast.error(err instanceof Error ? err.message : "Publication impossible.");
      }
    } finally {
      setPublishing(false);
    }
  };

  // ----- Quitter (sauvegarde avant navigation) -----
  const leave = async () => {
    if (pendingRef.current.fields || pendingRef.current.meta) {
      const ok = await saveNow();
      if (!ok) {
        toast.error("Des modifications n'ont pas pu être enregistrées — vérifiez votre connexion.");
        return;
      }
    }
    navigate({ name: "dashboard" });
  };

  const onTitleChange = (v: string) => {
    setTitle(v);
    markDirty("meta");
  };

  // ----- Bibliothèque filtrée (Q.3) -----
  const q = search.trim().toLowerCase();
  const matchesEntry = (code: FieldType): boolean => {
    if (!q) return true;
    const e = FIELD_CATALOG[code];
    return (
      e.label.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      code.includes(q)
    );
  };
  const familyGroups = QUESTION_FAMILIES.map((family) => ({
    family,
    entries: QUESTION_TYPES.filter((t) => FIELD_CATALOG[t].family === family && matchesEntry(t)),
  })).filter((g) => g.entries.length > 0);
  const contentEntries = CONTENT_TYPES.filter((t) => matchesEntry(t));
  const nothingFound = familyGroups.length === 0 && contentEntries.length === 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const savedTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ============================================================
  // Rendu
  // ============================================================

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="hidden h-5 w-36 rounded-md sm:block" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_360px]">
          <Skeleton className="h-[440px] rounded-2xl" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="hidden h-[560px] rounded-2xl xl:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* ---------- Barre supérieure (F.4.1) ---------- */}
      <div className="sticky top-16 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => void leave()}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quitter</span>
          </Button>

          <Badge variant="outline" className="hidden shrink-0 text-[10px] font-normal uppercase tracking-wide text-muted-foreground md:inline-flex">
            {STATUS_LABELS[status] ?? status}
          </Badge>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={flushPending}
            placeholder="Titre du formulaire"
            aria-label="Titre du formulaire"
            className="h-9 min-w-[160px] max-w-[340px] flex-1 border-transparent bg-transparent font-display text-base font-semibold shadow-none hover:border-border hover:bg-background focus-visible:bg-background sm:text-lg"
          />

          {/* Indicateur d'état d'enregistrement */}
          {saving ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…
            </span>
          ) : dirty ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="status" aria-live="polite">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" /> Modifications non enregistrées
            </span>
          ) : savedTime ? (
            <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex" role="status" aria-live="polite">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Enregistré à {savedTime}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {showPreview && (
              <div className="flex items-center rounded-lg border border-border/70 p-0.5" role="group" aria-label="Format de l'aperçu">
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  aria-pressed={previewMode === "desktop"}
                  aria-label="Aperçu bureau"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    previewMode === "desktop" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  aria-pressed={previewMode === "mobile"}
                  aria-label="Aperçu mobile (375 px)"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    previewMode === "mobile" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowPreview((s) => !s)}
              aria-pressed={showPreview}
              aria-label={showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => void saveNow()} disabled={!dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Enregistrer</span>
            </Button>
            {status === "draft" ? (
              <Button className="h-9 gap-1.5" onClick={() => void publish()} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publier
              </Button>
            ) : (
              <Button variant="secondary" className="h-9 gap-1.5" onClick={() => navigate({ name: "share", formId })}>
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Voir les liens</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Espace de travail : bibliothèque · canevas · propriétés + aperçu ---------- */}
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_360px]">
        {/* ===== Bibliothèque de champs (gauche) ===== */}
        <aside aria-label="Bibliothèque de champs">
          <Card className="rounded-2xl border-border/70">
            <CardContent className="space-y-4 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un champ…"
                  aria-label="Rechercher dans la bibliothèque de champs"
                  className="h-9 pl-9"
                />
              </div>

              <nav className="max-h-[380px] space-y-4 overflow-y-auto pr-1" aria-label="Types de champs disponibles">
                {familyGroups.map((group) => (
                  <div key={group.family}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {FAMILY_LABELS[group.family]}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.entries.map((code) => (
                        <LibraryButton key={code} entry={FIELD_CATALOG[code]} onAdd={() => addField(code)} />
                      ))}
                    </div>
                  </div>
                ))}

                {contentEntries.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {FAMILY_LABELS.content}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {contentEntries.map((code) => (
                        <LibraryButton key={code} entry={FIELD_CATALOG[code]} onAdd={() => addField(code)} />
                      ))}
                    </div>
                  </div>
                )}

                {nothingFound && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Aucun champ ne correspond à « {search} ».
                  </p>
                )}
              </nav>

              {/* Jeux de réponses prêts à l'emploi (Q.4) */}
              {selectedHasChoices && selected && (
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <ListChecks className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Jeux de réponses prêts à l&apos;emploi
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Applique un jeu standard au champ « {selected.label} » — remplace ses options actuelles.
                  </p>
                  <div className="mt-2 max-h-52 space-y-2.5 overflow-y-auto pr-1">
                    {ANSWER_SET_CATEGORIES.map((cat) => (
                      <div key={cat}>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{cat}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ANSWER_SETS.filter((s) => s.category === cat).map((s) => (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => applyAnswerSet(s)}
                              className="rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ===== Canevas central ===== */}
        <section aria-label="Canevas du formulaire" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Structure du formulaire</h2>
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              {fields.filter((f) => FIELD_CATALOG[f.type]?.isQuestion !== false).length} question(s) · {fields.length}/{MAX_FIELDS} blocs
            </Badge>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <Plus className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-4 font-display text-lg font-medium">Commencez par ajouter un champ</p>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Choisissez un type de question dans la bibliothèque de gauche — il apparaîtra ici.
                Vous pourrez le déplacer, le configurer et suivre le résultat dans l&apos;aperçu en direct.
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2.5">
                  {fields.map((f, i) => (
                    <SortableFieldCard
                      key={f.key}
                      field={f}
                      index={i}
                      selected={f.key === selectedKey}
                      onSelect={() => setSelectedKey(f.key)}
                      onLabelChange={(label) => updateField(f.key, { label })}
                      onRequiredChange={(v) => updateField(f.key, { isRequired: v })}
                      onDuplicate={() => duplicateField(f.key)}
                      onRemove={() => removeField(f.key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {fields.length > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Glissez la poignée pour réordonner · cliquez sur une carte pour éditer ses propriétés ·
              Ctrl/⌘ + S pour enregistrer.
            </p>
          )}
        </section>

        {/* ===== Propriétés + aperçu en direct (droite, sticky) ===== */}
        <aside
          aria-label="Propriétés et aperçu"
          className="flex flex-col gap-5 pb-6 lg:sticky lg:top-[130px] lg:max-h-[calc(100vh-146px)] lg:self-start lg:overflow-y-auto lg:pr-1"
        >
          <Card className="shrink-0 rounded-2xl border-border/70">
            <CardContent className="p-4">
              {selected && selectedEntry ? (
                <Tabs defaultValue="field">
                  <TabsList className="grid h-9 w-full grid-cols-3">
                    <TabsTrigger value="field">Champ</TabsTrigger>
                    <TabsTrigger value="design">Design</TabsTrigger>
                    <TabsTrigger value="settings">Paramètres</TabsTrigger>
                  </TabsList>
                  <TabsContent value="field" className="mt-3">
                    <FieldProperties
                      key={selected.key}
                      field={selected}
                      entry={selectedEntry}
                      onUpdate={(patch) => updateField(selected.key, patch)}
                      onOptions={(patch) => patchOptions(selected.key, patch)}
                    />
                  </TabsContent>
                  <TabsContent value="design" className="mt-3">
                    <DesignProperties theme={theme} onTheme={patchTheme} />
                  </TabsContent>
                  <TabsContent value="settings" className="mt-3">
                    <SettingsProperties
                      displayMode={displayMode}
                      onDisplayMode={patchDisplayMode}
                      settings={settings}
                      onSettings={patchSettings}
                      onOpenShare={() => navigate({ name: "share", formId })}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="py-10 text-center">
                  <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
                  <p className="mt-2.5 text-sm font-medium">Aucun champ sélectionné</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Cliquez sur une carte du canevas pour éditer son libellé, ses options et ses réglages.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {showPreview && (
            <Card className="shrink-0 rounded-2xl border-border/70">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Aperçu en direct
                  </p>
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                    {previewMode === "desktop" ? "Bureau" : "375 px"}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "overflow-hidden rounded-xl border border-border bg-background",
                    previewMode === "mobile" && "mx-auto w-full max-w-[375px] shadow-sm"
                  )}
                >
                  <FormRenderer
                    fields={fields}
                    theme={theme}
                    settings={settings}
                    displayMode={displayMode}
                    mode="preview"
                    estimateMinutes={settings.estimateMinutes}
                    onSubmitPreview={() => {}}
                    className="max-h-[60vh] min-h-[320px] overflow-y-auto"
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Rendu identique au formulaire public — se met à jour en temps réel.
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* ---------- Dialog de checklist de publication ---------- */}
      <Dialog open={publishIssues !== null} onOpenChange={(o) => { if (!o) setPublishIssues(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Publication impossible</DialogTitle>
            <DialogDescription>
              La checklist de publication (Q.16) a relevé les points suivants à corriger :
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {(publishIssues ?? []).map((issue, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm leading-snug">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishIssues(null)}>
              J&apos;ai compris, corriger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Bouton de la bibliothèque
// ============================================================

function LibraryButton({ entry, onAdd }: { entry: CatalogEntry; onAdd: () => void }) {
  const Icon: LucideIcon = (entry.icon && ICONS[entry.icon]) || CircleDot;
  return (
    <button
      type="button"
      onClick={onAdd}
      title={`${entry.label} — ${entry.description}`}
      className="group flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium leading-tight">{entry.label}</span>
    </button>
  );
}

// ============================================================
// Carte triable du canevas
// ============================================================

interface SortableFieldCardProps {
  field: FormFieldDef;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onLabelChange: (label: string) => void;
  onRequiredChange: (v: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function SortableFieldCard({
  field,
  index,
  selected,
  onSelect,
  onLabelChange,
  onRequiredChange,
  onDuplicate,
  onRemove,
}: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  const entry = FIELD_CATALOG[field.type];
  const isContent = entry?.isQuestion === false;
  const Icon: LucideIcon = (entry?.icon && ICONS[entry.icon]) || CircleDot;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-3 transition-colors",
        selected
          ? "border-primary/60 shadow-[0_0_0_1px_rgba(176,141,87,0.25)]"
          : "border-border/70 hover:border-primary/40",
        isContent && "bg-muted/30",
        isDragging && "z-20 opacity-90 shadow-lg"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Poignée de glisser-déposer */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Déplacer « ${field.label} »`}
          className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-muted-foreground" aria-hidden="true">
          {index + 1}
        </span>

        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            isContent ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        {/* Édition en place du libellé */}
        <Input
          value={field.label}
          onChange={(e) => onLabelChange(e.target.value)}
          onFocus={onSelect}
          onClick={(e) => e.stopPropagation()}
          placeholder="Libellé de la question"
          aria-label={`Libellé du bloc ${index + 1}`}
          className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:border-border hover:bg-background focus-visible:bg-background"
        />

        <Badge variant="outline" className="hidden shrink-0 text-[10px] font-normal text-muted-foreground lg:inline-flex">
          {entry?.label ?? field.type}
        </Badge>

        {field.isRequired && !isContent && (
          <span className="shrink-0 text-base font-bold leading-none text-primary" title="Champ obligatoire" aria-label="Champ obligatoire">
            *
          </span>
        )}

        {!isContent && (
          <div className="hidden items-center gap-1.5 md:flex" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor={`req-${field.key}`} className="sr-only">
              Champ obligatoire
            </Label>
            <Switch
              id={`req-${field.key}`}
              checked={field.isRequired}
              onCheckedChange={onRequiredChange}
              aria-label="Basculer champ obligatoire"
            />
          </div>
        )}

        {/* Menu d'actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Actions sur « ${field.label} »`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Dupliquer
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRequiredChange(!field.isRequired)}>
              <Check className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {field.isRequired ? "Rendre facultatif" : "Rendre obligatoire"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {field.options.help ? (
        <p className="ml-[104px] mt-1 truncate text-[11px] text-muted-foreground">{field.options.help}</p>
      ) : null}
    </div>
  );
}

// ============================================================
// Panneau de propriétés — onglet « Champ »
// ============================================================

interface FieldPropertiesProps {
  field: FormFieldDef;
  entry: CatalogEntry;
  onUpdate: (patch: Partial<FormFieldDef>) => void;
  onOptions: (patch: Partial<FieldOptions>) => void;
}

function FieldProperties({ field, entry, onUpdate, onOptions }: FieldPropertiesProps) {
  const opts = field.options;
  const isQuestion = entry.isQuestion !== false;
  const Icon: LucideIcon = ICONS[entry.icon] || CircleDot;

  return (
    <div className="space-y-4">
      {/* En-tête : type + clé technique */}
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", isQuestion ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry.label}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{field.key}</p>
        </div>
      </div>

      <div>
        <Label htmlFor="fp-label" className="text-xs font-medium">Libellé</Label>
        <Input
          id="fp-label"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="mt-1.5 h-9 text-sm"
          placeholder="Question ou intitulé du bloc"
        />
      </div>

      {field.type === "hidden" && (
        <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Ce champ n&apos;est jamais affiché aux répondants : sa valeur est fournie automatiquement par
          le lien de collecte (source de la visite, campagne, membre collecteur…).
        </p>
      )}

      <div>
        <Label htmlFor="fp-help" className="text-xs font-medium">Texte d&apos;aide</Label>
        <Input
          id="fp-help"
          value={opts.help ?? ""}
          onChange={(e) => onOptions({ help: e.target.value || undefined })}
          className="mt-1.5 h-9 text-sm"
          placeholder="Indication affichée sous la question (facultatif)"
        />
      </div>

      {PLACEHOLDER_TYPES.includes(field.type) && (
        <div>
          <Label htmlFor="fp-placeholder" className="text-xs font-medium">Placeholder</Label>
          <Input
            id="fp-placeholder"
            value={opts.placeholder ?? ""}
            onChange={(e) => onOptions({ placeholder: e.target.value || undefined })}
            className="mt-1.5 h-9 text-sm"
            placeholder="Exemple de saisie affiché dans le champ"
          />
        </div>
      )}

      {isQuestion && (
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
          <div>
            <Label htmlFor="fp-required" className="text-xs font-medium">Obligatoire</Label>
            <p className="text-[10px] text-muted-foreground">Le répondant ne peut pas continuer sans répondre.</p>
          </div>
          <Switch
            id="fp-required"
            checked={field.isRequired}
            onCheckedChange={(v) => onUpdate({ isRequired: v })}
          />
        </div>
      )}

      {/* ----- Réglages spécifiques au type ----- */}
      {LENGTH_TYPES.includes(field.type) && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <NumberOption
              id="fp-minlen"
              label="Longueur min."
              value={opts.minLength}
              min={0}
              max={2000}
              onChange={(v) => onOptions({ minLength: clampInt(v, 0, 2000) })}
            />
            <NumberOption
              id="fp-maxlen"
              label="Longueur max."
              value={opts.maxLength}
              min={1}
              max={10000}
              onChange={(v) => onOptions({ maxLength: clampInt(v, 1, 10000) })}
            />
          </div>
        </>
      )}

      {NUMBER_TYPES.includes(field.type) && (
        <>
          <Separator />
          <div className="grid grid-cols-3 gap-2.5">
            <NumberOption
              id="fp-min"
              label="Min"
              value={opts.min}
              onChange={(v) => onOptions({ min: v })}
            />
            <NumberOption
              id="fp-max"
              label="Max"
              value={opts.max}
              onChange={(v) => onOptions({ max: v })}
            />
            <NumberOption
              id="fp-step"
              label="Pas"
              value={opts.step}
              min={0}
              onChange={(v) => onOptions({ step: clampInt(v, 0, 1000000) })}
            />
          </div>
          {field.type === "decimal" && (
            <div>
              <Label htmlFor="fp-currency" className="text-xs font-medium">Devise</Label>
              <Input
                id="fp-currency"
                value={opts.currency ?? ""}
                onChange={(e) => onOptions({ currency: e.target.value.toUpperCase().slice(0, 3) || undefined })}
                className="mt-1.5 h-9 text-sm"
                placeholder="EUR"
                maxLength={3}
              />
            </div>
          )}
        </>
      )}

      {(field.type === "rating_stars" || field.type === "nps") && (
        <>
          <Separator />
          <div>
            <Label className="text-xs font-medium">Échelle maximale</Label>
            <Select
              value={String(opts.maxValue ?? (field.type === "nps" ? 10 : 5))}
              onValueChange={(v) => onOptions({ maxValue: Number(v) })}
            >
              <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(field.type === "nps" ? [5, 10] : [3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {field.type === "nps" ? `0 – ${n}` : `${n} étoiles`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {field.type === "likert" && (
        <>
          <Separator />
          <div>
            <Label className="text-xs font-medium">Nombre de niveaux</Label>
            <Select
              value={String(opts.levels ?? 5)}
              onValueChange={(v) => onOptions({ levels: Number(v) })}
            >
              <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 5, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} niveaux</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {(LIKERT_LABELS[opts.levels ?? 5] ?? LIKERT_LABELS[5]).join(" · ")}
            </p>
          </div>
        </>
      )}

      {SCALE_LABEL_TYPES.includes(field.type) && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fp-left" className="text-[11px] font-medium text-muted-foreground">Extrémité gauche</Label>
              <Input
                id="fp-left"
                value={opts.labels?.left ?? ""}
                onChange={(e) => onOptions({ labels: { ...opts.labels, left: e.target.value || undefined } })}
                className="mt-1 h-9 text-sm"
                placeholder="Pas du tout"
              />
            </div>
            <div>
              <Label htmlFor="fp-right" className="text-[11px] font-medium text-muted-foreground">Extrémité droite</Label>
              <Input
                id="fp-right"
                value={opts.labels?.right ?? ""}
                onChange={(e) => onOptions({ labels: { ...opts.labels, right: e.target.value || undefined } })}
                className="mt-1 h-9 text-sm"
                placeholder="Tout à fait"
              />
            </div>
          </div>
        </>
      )}

      {field.type === "phone" && (
        <>
          <Separator />
          <div>
            <Label className="text-xs font-medium">Indicatif par défaut</Label>
            <Select
              value={opts.defaultCountry ?? "FR"}
              onValueChange={(v) => onOptions({ defaultCountry: v })}
            >
              <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.dial})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {field.type === "consent" && (
        <>
          <Separator />
          <div>
            <Label htmlFor="fp-consent" className="text-xs font-medium">Texte de consentement</Label>
            <Textarea
              id="fp-consent"
              value={opts.consentText ?? ""}
              onChange={(e) => onOptions({ consentText: e.target.value || undefined })}
              rows={3}
              className="mt-1.5 text-sm"
              placeholder="J'accepte que mes informations soient utilisées…"
            />
          </div>
        </>
      )}

      {CONTENT_TEXT_TYPES.includes(field.type) && (
        <>
          <Separator />
          <div>
            <Label htmlFor="fp-content" className="text-xs font-medium">
              {field.type === "section_title" ? "Sous-titre" : "Contenu"}
            </Label>
            <Textarea
              id="fp-content"
              value={opts.content ?? ""}
              onChange={(e) => onOptions({ content: e.target.value || undefined })}
              rows={4}
              className="mt-1.5 text-sm"
              placeholder={field.type === "welcome_screen" ? "Message affiché avant de commencer…" : field.type === "end_screen" ? "Message de remerciement…" : "Votre texte…"}
            />
          </div>
        </>
      )}

      {field.type === "image_block" && (
        <>
          <Separator />
          <div>
            <Label htmlFor="fp-image" className="text-xs font-medium">URL de l&apos;image</Label>
            <Input
              id="fp-image"
              type="url"
              value={opts.imageUrl ?? ""}
              onChange={(e) => onOptions({ imageUrl: e.target.value || undefined })}
              className="mt-1.5 h-9 text-sm"
              placeholder="https://…/illustration.jpg"
            />
            {opts.imageUrl ? (
              <img
                src={opts.imageUrl}
                alt={`Aperçu de l'image du bloc ${field.label}`}
                className="mt-2 max-h-32 w-full rounded-lg border border-border/70 object-cover"
              />
            ) : null}
          </div>
        </>
      )}

      {entry.hasChoices && (
        <>
          <Separator />
          {LAYOUT_TYPES.includes(field.type) && (
            <div>
              <Label className="text-xs font-medium">Disposition</Label>
              <Select
                value={opts.layout ?? "vertical"}
                onValueChange={(v) => onOptions({ layout: v as "vertical" | "horizontal" })}
              >
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Verticale (liste)</SelectItem>
                  <SelectItem value="horizontal">Horizontale (côte à côte)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <ChoicesEditor
            choices={opts.choices ?? []}
            onChange={(choices) => onOptions({ choices })}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// Éditeur d'options de réponse (choix) — QA-02
// ============================================================

function ChoicesEditor({ choices, onChange }: { choices: ChoiceOption[]; onChange: (c: ChoiceOption[]) => void }) {
  const [bulk, setBulk] = useState("");

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= choices.length) return;
    onChange(arrayMove(choices, i, j));
  };

  const update = (i: number, patch: Partial<ChoiceOption>) => {
    onChange(choices.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const remove = (i: number) => {
    onChange(choices.filter((_, idx) => idx !== i));
  };

  const add = () => {
    if (choices.length >= MAX_CHOICES) {
      toast.warning(`Maximum ${MAX_CHOICES} options par question.`);
      return;
    }
    const existing = new Set(choices.map((c) => c.value));
    let n = choices.length + 1;
    let v = `option_${n}`;
    while (existing.has(v)) {
      n += 1;
      v = `option_${n}`;
    }
    onChange([...choices, { value: v, label: `Option ${n}` }]);
  };

  const uniqueValue = (base: string, existing: Set<string>): string => {
    let v = base;
    let n = 2;
    while (existing.has(v)) {
      v = `${base}_${n}`;
      n += 1;
    }
    return v;
  };

  const importBulk = () => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Collez d'abord votre liste — une option par ligne.");
      return;
    }
    if (choices.length + lines.length > MAX_CHOICES) {
      toast.warning(`Maximum ${MAX_CHOICES} options par question.`);
      return;
    }
    const existing = new Set(choices.map((c) => c.value));
    const imported: ChoiceOption[] = lines.map((line) => {
      const slug =
        line
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || "option";
      const value = uniqueValue(slug, existing);
      existing.add(value);
      return { value, label: line };
    });
    onChange([...choices, ...imported]);
    setBulk("");
    toast.success(`${imported.length} option(s) importée(s) (QA-02).`);
  };

  const hasOther = choices.some((c) => c.allowText);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Options de réponse</Label>
        <span className="text-[10px] text-muted-foreground">{choices.length}/{MAX_CHOICES}</span>
      </div>

      <div className="space-y-1.5">
        {choices.map((c, i) => (
          <div key={`${c.value}-${i}`} className="flex items-center gap-1.5">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Monter l'option ${i + 1}`}
                className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-25"
              >
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === choices.length - 1}
                aria-label={`Descendre l'option ${i + 1}`}
                className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-25"
              >
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <Input
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Libellé affiché"
              aria-label={`Libellé de l'option ${i + 1}`}
              className="h-8 min-w-0 flex-1 text-xs"
            />
            <Input
              value={c.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="valeur"
              aria-label={`Valeur technique de l'option ${i + 1}`}
              className="h-8 w-[72px] shrink-0 font-mono text-[11px] text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Supprimer l'option ${i + 1}`}
              className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
        {choices.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-center text-[11px] text-muted-foreground">
            Aucune option — ajoutez-en ci-dessous ou importez une liste.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Ajouter une option
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
        <div className="min-w-0">
          <Label htmlFor="fp-allow-other" className="text-xs font-medium">Autoriser « Autre (précisez) »</Label>
          <p className="text-[10px] leading-snug text-muted-foreground">Ajoute un choix libre avec zone de texte.</p>
        </div>
        <Switch
          id="fp-allow-other"
          checked={hasOther}
          onCheckedChange={(v) => {
            if (v) {
              const existing = new Set(choices.map((c) => c.value));
              onChange([
                ...choices,
                { value: uniqueValue("autre", existing), label: "Autre (précisez)", allowText: true },
              ]);
            } else {
              onChange(choices.filter((c) => !c.allowText));
            }
          }}
        />
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
        <Label htmlFor="fp-bulk" className="text-xs font-medium">Coller une liste (une option par ligne)</Label>
        <Textarea
          id="fp-bulk"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={3}
          className="mt-1.5 min-h-16 text-xs"
          placeholder={"Café\nThé\nChocolat chaud"}
        />
        <Button type="button" variant="outline" size="sm" className="mt-2 h-8 w-full gap-1.5 text-xs" onClick={importBulk}>
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" /> Importer en lot (QA-02)
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Panneau de propriétés — onglet « Design »
// ============================================================

function DesignProperties({ theme, onTheme }: { theme: FormTheme; onTheme: (patch: Partial<FormTheme>) => void }) {
  const currentAccent = theme.accent ?? ACCENT_PRESETS[0].color;
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium">Couleur d&apos;accent</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.color}
              type="button"
              onClick={() => onTheme({ accent: preset.color })}
              aria-label={`Accent ${preset.name}`}
              aria-pressed={currentAccent === preset.color}
              title={preset.name}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-transform hover:scale-105",
                currentAccent === preset.color ? "border-foreground shadow-md" : "border-transparent"
              )}
              style={{ backgroundColor: preset.color }}
            />
          ))}
          <label
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            title="Couleur personnalisée"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <input
              type="color"
              value={currentAccent}
              onChange={(e) => onTheme({ accent: e.target.value })}
              aria-label="Couleur d'accent personnalisée"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor="theme-logo" className="text-xs font-medium">Logo (URL)</Label>
        <Input
          id="theme-logo"
          type="url"
          value={theme.logoUrl ?? ""}
          onChange={(e) => onTheme({ logoUrl: e.target.value || undefined })}
          className="mt-1.5 h-9 text-sm"
          placeholder="https://…/logo.png"
        />
      </div>

      <div>
        <Label htmlFor="theme-banner" className="text-xs font-medium">Bannière (URL)</Label>
        <Input
          id="theme-banner"
          type="url"
          value={theme.bannerUrl ?? ""}
          onChange={(e) => onTheme({ bannerUrl: e.target.value || undefined })}
          className="mt-1.5 h-9 text-sm"
          placeholder="https://…/banniere.jpg"
        />
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Palette className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Le thème est appliqué à l&apos;aperçu et au formulaire public. Enregistrement automatique.
      </p>
    </div>
  );
}

// ============================================================
// Panneau de propriétés — onglet « Paramètres »
// ============================================================

function SettingsProperties({
  displayMode,
  onDisplayMode,
  settings,
  onSettings,
  onOpenShare,
}: {
  displayMode: string;
  onDisplayMode: (v: string) => void;
  settings: FormSettings;
  onSettings: (patch: Partial<FormSettings>) => void;
  onOpenShare: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium">Mode d&apos;affichage</Label>
        <Select value={displayMode} onValueChange={onDisplayMode}>
          <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="single_page">Une seule page</SelectItem>
            <SelectItem value="multi_step">Par étapes (barre de progression)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="fp-estimate" className="text-xs font-medium">Durée estimée (minutes)</Label>
        <Input
          id="fp-estimate"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          value={settings.estimateMinutes ?? ""}
          onChange={(e) => onSettings({ estimateMinutes: clampInt(parseNumber(e.target.value), 0, 120) })}
          className="mt-1.5 h-9 text-sm"
          placeholder="3"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Affichée sur l&apos;écran d&apos;accueil pour rassurer les répondants.
        </p>
      </div>

      <Separator />

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Les réglages de collecte — liens dérivés, invitations d&apos;équipe, déduplication, clôture —
        se gèrent sur l&apos;écran de partage.
      </p>
      <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={onOpenShare}>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ouvrir l&apos;écran de partage
      </Button>
    </div>
  );
}

// ============================================================
// Petit champ numérique réutilisable
// ============================================================

function NumberOption({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(parseNumber(e.target.value))}
        className="mt-1 h-9 text-sm"
        placeholder="—"
      />
    </div>
  );
}
