"use client";

// ============================================================
// FormRenderer — rendu d'un formulaire (écran 10, E-01..E-11, §8.2)
// Utilisé par : formulaire public, aperçu du constructeur, aperçu membre.
// Principes directeurs : une colonne, libellés au-dessus, validation douce,
// zones tactiles ≥ 48 px, bouton principal unique, charge cognitive minimale.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, ChevronRight, ChevronLeft, Send, AlertCircle, CheckCircle2, Info, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateAnswer, LIKERT_LABELS, COUNTRIES, type AnswerValue } from "@/lib/fields";
import type { FormFieldDef, FormSettings, FormTheme } from "@/lib/types";

export interface FormRendererProps {
  fields: FormFieldDef[];
  theme?: FormTheme;
  settings?: FormSettings;
  displayMode?: string; // single_page | multi_step
  mode: "live" | "preview";
  slug?: string; // requis en mode live
  collectorName?: string;
  estimateMinutes?: number;
  onSubmitPreview?: (answers: Record<string, AnswerValue>) => void;
  className?: string;
}

interface Pages {
  welcome?: FormFieldDef;
  end?: FormFieldDef;
  pages: FormFieldDef[][];
}

function splitPages(fields: FormFieldDef[], displayMode?: string): Pages {
  const welcome = fields.find((f) => f.type === "welcome_screen");
  const end = fields.find((f) => f.type === "end_screen");
  const content = fields.filter((f) => f.type !== "welcome_screen" && f.type !== "end_screen");

  const pages: FormFieldDef[][] = [];
  let current: FormFieldDef[] = [];
  let sawBreak = false;
  for (const f of content) {
    if (f.type === "page_break") {
      if (current.length) pages.push(current);
      current = [];
      sawBreak = true;
      continue;
    }
    current.push(f);
  }
  if (current.length) pages.push(current);
  const multiStep = displayMode === "multi_step" || sawBreak;
  return {
    welcome,
    end,
    pages: multiStep && pages.length > 0 ? pages : [content],
  };
}

export function FormRenderer(props: FormRendererProps) {
  const { fields, theme, settings, displayMode, mode, slug, collectorName, estimateMinutes } = props;
  const accent = theme?.accent || "var(--gold)";

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [others, setOthers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [started, setStarted] = useState(!fields.some((f) => f.type === "welcome_screen"));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; allowAnother: boolean } | null>(null);
  const startedAt = useRef<number>(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  const structure = useMemo(() => splitPages(fields, displayMode), [fields, displayMode]);
  const totalPages = structure.pages.length;
  const isMultiStep = totalPages > 1;

  // Aperçu du builder : l'ajout/retrait d'un écran d'accueil est reflété immédiatement.
  const hasWelcome = structure.welcome !== undefined;
  useEffect(() => {
    setStarted(!hasWelcome);
  }, [hasWelcome]);

  /** Message de fin : l'écran de fin du formulaire (s'il existe) prime sur le réglage général. */
  const endMessage = structure.end?.options.content?.trim() || settings?.finalMessage || "Merci ! Vos informations ont bien été envoyées.";

  const setAnswer = (key: string, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [key]: value }));
  };

  const validateField = (f: FormFieldDef, value: AnswerValue): string | null => {
    if (f.type === "hidden") return null;
    const err = validateAnswer(f, value);
    if (err) return err;
    // « Autre (précisez) » sans texte (QA-04)
    const choices = f.options.choices ?? [];
    const selected = choices.find((c) => c.value === value);
    if (selected?.allowText && !others[`${f.key}_other`]?.trim()) {
      return "Précisez votre réponse.";
    }
    if (f.type === "multiple_choice" && Array.isArray(value)) {
      const min = f.options.min ?? 0;
      const max = f.options.max ?? Infinity;
      if (value.length < min) return `Sélectionnez au moins ${min} option(s).`;
      if (value.length > max) return `Sélectionnez au maximum ${max} option(s).`;
      for (const c of choices) {
        if (c.allowText && arrIncludes(value, c.value) && !others[`${f.key}_other`]?.trim()) {
          return "Précisez votre réponse.";
        }
      }
    }
    return null;
  };

  const blurField = (f: FormFieldDef) => {
    setTouched((t) => ({ ...t, [f.key]: true }));
    const err = validateField(f, answers[f.key]);
    setErrors((e) => {
      const next = { ...e };
      if (err) next[f.key] = err;
      else delete next[f.key];
      return next;
    });
  };

  const validateAll = (fieldsSubset: FormFieldDef[]): Record<string, string> => {
    const errs: Record<string, string> = {};
    for (const f of fieldsSubset) {
      const err = validateField(f, answers[f.key]);
      if (err) errs[f.key] = err;
    }
    return errs;
  };

  const scrollToFirstError = (errs: Record<string, string>) => {
    requestAnimationFrame(() => {
      const firstKey = Object.keys(errs)[0];
      const el = rootRef.current?.querySelector(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const goNext = () => {
    const pageFields = structure.pages[page] ?? [];
    const errs = validateAll(pageFields);
    if (Object.keys(errs).length > 0) {
      setErrors((e) => ({ ...e, ...errs }));
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(errs).map((k) => [k, true])) }));
      scrollToFirstError(errs);
      return;
    }
    setPage((p) => Math.min(p + 1, totalPages - 1));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const errs = validateAll(structure.pages.flat());
    if (Object.keys(errs).length > 0) {
      setErrors((e) => ({ ...e, ...errs }));
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(errs).map((k) => [k, true])) }));
      scrollToFirstError(errs);
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, AnswerValue> = { ...answers };
      for (const [k, v] of Object.entries(others)) payload[k] = v;
      payload.__hp = (answers.__hp as string) ?? "";

      if (mode === "preview") {
        props.onSubmitPreview?.(payload);
        setDone({ message: endMessage, allowAnother: true });
      } else {
        const { api } = await import("@/lib/api");
        const res = await api.post<{ ok: boolean; message: string; allowAnother?: boolean }>(`/api/f/${slug}/submit`, {
          answers: payload,
          _hp: payload.__hp,
          startedAt: startedAt.current,
        });
        setDone({ message: res.message, allowAnother: !!res.allowAnother });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const e = err as { code?: string; fields?: Record<string, string>; message?: string };
      if (e.fields && Object.keys(e.fields).length) {
        setErrors((prev) => ({ ...prev, ...e.fields }));
        setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(e.fields!).map((k) => [k, true])) }));
        scrollToFirstError(e.fields!);
      } else {
        // Erreur sans champ : alerter dans le formulaire, JAMAIS sur l'écran de succès
        setSubmitError(e.message ?? "Une erreur est survenue. Réessayez.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setAnswers({});
    setOthers({});
    setErrors({});
    setTouched({});
    setPage(0);
    setDone(null);
    setStarted(false);
    startedAt.current = Date.now();
  };

  // ---------- Écran de confirmation (E-07) ----------
  if (done) {
    return (
      <div className={cn("mx-auto w-full max-w-xl px-4 py-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500", props.className)}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: accent }} />
        </div>
        <h2 className="font-display mt-6 text-2xl font-semibold">Merci !</h2>
        <p className="mt-3 text-muted-foreground">{done.message}</p>
        {done.allowAnother && (
          <Button variant="outline" className="mt-8" onClick={resetAll}>
            Remplir un autre formulaire
          </Button>
        )}
      </div>
    );
  }

  // ---------- Écran d'accueil (welcome_screen, Q.8.2) ----------
  if (!started && structure.welcome) {
    const w = structure.welcome;
    return (
      <div className={cn("mx-auto w-full max-w-xl px-4 py-14 text-center animate-in fade-in slide-in-from-bottom-4 duration-500", props.className)}>
        {theme?.logoUrl ? (
           
          <img src={theme.logoUrl} alt="Logo" className="mx-auto mb-8 h-16 w-16 rounded-2xl object-cover" />
        ) : null}
        <h1 className="font-display text-3xl font-semibold text-balance">{w.label}</h1>
        {w.options.content ? <p className="mt-4 text-muted-foreground whitespace-pre-line">{w.options.content}</p> : null}
        {estimateMinutes ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Environ {estimateMinutes} minute{estimateMinutes > 1 ? "s" : ""}
          </p>
        ) : null}
        <Button
          size="lg"
          className="mt-10 h-12 px-8 text-base"
          style={{ background: accent, color: "#fff" }}
          onClick={() => {
            setStarted(true);
            startedAt.current = Date.now();
          }}
        >
          Commencer
        </Button>
      </div>
    );
  }

  const pageFields = structure.pages[page] ?? [];
  const progress = isMultiStep ? Math.round(((page + 1) / totalPages) * 100) : null;

  return (
    <div ref={rootRef} className={cn("mx-auto w-full max-w-xl px-4 pb-24 pt-6", props.className)}>
      {theme?.bannerUrl ? (
         
        <img src={theme.bannerUrl} alt="" className="mb-6 h-28 w-full rounded-xl object-cover" />
      ) : null}
      {collectorName ? (
        <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: accent }}>
          Collecté par {collectorName}
        </p>
      ) : null}

      {progress !== null && (
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Étape {page + 1} sur {totalPages}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" indicatorColor={accent} />
        </div>
      )}

      <div className="space-y-7">
        {pageFields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={answers[f.key]}
            otherValue={others[`${f.key}_other`] ?? ""}
            error={touched[f.key] ? errors[f.key] : undefined}
            accent={accent}
            onChange={(v) => {
              setAnswer(f.key, v);
              if (touched[f.key]) {
                const err = validateField(f, v);
                setErrors((e) => {
                  const next = { ...e };
                  if (err) next[f.key] = err;
                  else delete next[f.key];
                  return next;
                });
              }
            }}
            onOtherChange={(v) => {
              setOthers((o) => ({ ...o, [`${f.key}_other`]: v }));
            }}
            onBlur={() => blurField(f)}
          />
        ))}

        {/* Champ piège honeypot (E-06) — invisible pour l'humain */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="__hp_field">Ne pas remplir ce champ</label>
          <input
            id="__hp_field"
            name="__hp"
            tabIndex={-1}
            autoComplete="off"
            value={(answers.__hp as string) ?? ""}
            onChange={(e) => setAnswer("__hp", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-10 flex items-center gap-3">
        {isMultiStep && page > 0 && (
          <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Button>
        )}
        {isMultiStep && page < totalPages - 1 ? (
          <Button type="button" size="lg" className="h-12 flex-1 text-base" style={{ background: accent, color: "#fff" }} onClick={goNext}>
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="h-12 flex-1 text-base"
            style={{ background: accent, color: "#fff" }}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Envoyer
              </>
            )}
          </Button>
        )}
      </div>

      {submitError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{submitError}</AlertDescription>
        </Alert>
      )}

      {settings?.consentText && page === totalPages - 1 && (
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          <Info className="mr-1 inline h-3 w-3" />
          {settings.consentText}
        </p>
      )}

      {mode === "live" && settings?.showBranding !== false && (
        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Propulsé par MEAH COLLECT
        </p>
      )}
    </div>
  );
}

function arrIncludes(arr: unknown, v: string): boolean {
  return Array.isArray(arr) && (arr as string[]).includes(v);
}

// ============================================================
// Rendu d'un champ
// ============================================================
interface FieldRowProps {
  field: FormFieldDef;
  value: AnswerValue;
  otherValue: string;
  error?: string;
  accent: string;
  onChange: (v: AnswerValue) => void;
  onOtherChange: (v: string) => void;
  onBlur: () => void;
}

function FieldRow(p: FieldRowProps) {
  const { field: f } = p;

  // ----- Blocs de contenu -----
  if (f.type === "divider") return <hr className="my-2 border-border/70" />;
  if (f.type === "section_title") {
    return (
      <div className="pt-4">
        <h3 className="font-display text-xl font-semibold">{f.label}</h3>
        {f.options.content ? <p className="mt-1 text-sm text-muted-foreground">{f.options.content}</p> : null}
      </div>
    );
  }
  if (f.type === "paragraph_text") {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{f.options.content || f.label}</p>;
  }
  if (f.type === "callout") {
    return (
      <Alert className="border-l-4" style={{ borderLeftColor: p.accent }}>
        <Info className="h-4 w-4" style={{ color: p.accent }} />
        <AlertDescription className="text-sm">{f.options.content || f.label}</AlertDescription>
      </Alert>
    );
  }
  if (f.type === "image_block") {
    if (!f.options.imageUrl) return null;
     
    return <img src={f.options.imageUrl} alt={f.label} className="w-full rounded-xl object-cover" />;
  }
  if (f.type === "hidden") return null;

  return (
    <div data-field={f.key} className="scroll-mt-24">
      <div className="mb-2.5">
        <label htmlFor={`fld-${f.key}`} className="block text-[15px] font-medium leading-snug">
          {f.label}
          {f.isRequired && <span className="ml-1" style={{ color: p.accent }}>*</span>}
        </label>
        {f.options.help ? <p className="mt-1 text-[13px] text-muted-foreground">{f.options.help}</p> : null}
      </div>

      <FieldControl {...p} />

      {p.error ? (
        <p id={`err-${f.key}`} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {p.error}
        </p>
      ) : null}
    </div>
  );
}

function FieldControl(p: FieldRowProps) {
  const { field: f, value } = p;
  const id = `fld-${f.key}`;
  const common = "h-12 text-[15px]"; // zones tactiles ≥ 48 px (§8.2)

  switch (f.type) {
    case "short_text":
    case "first_name":
    case "last_name":
    case "company":
    case "job_title":
    case "city":
    case "url":
      return (
        <Input
          id={id}
          type={f.type === "url" ? "url" : "text"}
          className={common}
          placeholder={f.options.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          aria-invalid={!!p.error}
          aria-describedby={p.error ? `err-${f.key}` : undefined}
          autoComplete={f.type === "first_name" ? "given-name" : f.type === "last_name" ? "family-name" : "off"}
        />
      );

    case "full_name":
      return (
        <Input
          id={id}
          className={common}
          placeholder={f.options.placeholder ?? "Prénom Nom"}
          value={(value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          autoComplete="name"
          aria-invalid={!!p.error}
        />
      );

    case "long_text":
      return (
        <div>
          <Textarea
            id={id}
            className="min-h-28 text-[15px]"
            placeholder={f.options.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
            maxLength={f.options.maxLength ?? 5000}
            aria-invalid={!!p.error}
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {((value as string) ?? "").length} / {f.options.maxLength ?? 5000}
          </p>
        </div>
      );

    case "email":
      return (
        <Input
          id={id}
          type="email"
          inputMode="email"
          className={common}
          placeholder={f.options.placeholder ?? "nom@domaine.com"}
          value={(value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          autoComplete="email"
          aria-invalid={!!p.error}
        />
      );

    case "phone": {
      const country = f.options.defaultCountry ?? "FR";
      const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+33";
      return (
        <div className="flex gap-2">
          <div className="flex h-12 min-w-28 items-center gap-1 rounded-md border border-input bg-transparent px-3 text-[15px]">
            <span className="text-sm">{flagEmoji(country)}</span>
            <span>{dial}</span>
          </div>
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            className={cn(common, "flex-1")}
            placeholder="6 12 34 56 78"
            value={(value as string) ?? ""}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
            aria-invalid={!!p.error}
          />
        </div>
      );
    }

    case "country":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => { p.onChange(v); p.onBlur(); }}
        >
          <SelectTrigger id={id} className={cn(common, "w-full")} aria-invalid={!!p.error}>
            <SelectValue placeholder="Sélectionnez votre pays" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "integer":
    case "decimal":
      return (
        <div className="relative">
          <Input
            id={id}
            type="number"
            inputMode={f.type === "decimal" ? "decimal" : "numeric"}
            step={f.type === "decimal" ? "0.01" : "1"}
            min={f.options.min}
            max={f.options.max}
            className={common}
            placeholder={f.options.placeholder}
            value={(value as string | number) ?? ""}
            onChange={(e) => p.onChange(e.target.value === "" ? null : e.target.value)}
            onBlur={p.onBlur}
            aria-invalid={!!p.error}
          />
          {f.type === "decimal" && f.options.currency ? (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{f.options.currency}</span>
          ) : null}
        </div>
      );

    case "date":
    case "birthdate":
      return (
        <Input
          id={id}
          type="date"
          className={common}
          value={(value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          aria-invalid={!!p.error}
        />
      );

    case "time":
      return (
        <Input
          id={id}
          type="time"
          className={common}
          value={(value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          aria-invalid={!!p.error}
        />
      );

    case "single_choice":
    case "yes_no":
    case "yes_no_unknown":
    case "true_false":
    case "true_false_unknown": {
      const choices = f.options.choices ?? [];
      const selectedChoice = choices.find((c) => c.value === value);
      return (
        <div>
          <RadioGroup
            value={(value as string) ?? ""}
            onValueChange={(v) => { p.onChange(v); p.onBlur(); }}
            className={cn("gap-2.5", f.options.layout === "horizontal" && choices.length <= 3 && "flex flex-row flex-wrap")}
            aria-describedby={p.error ? `err-${f.key}` : undefined}
          >
            {choices.map((c) => (
              <label
                key={c.value}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-all duration-150",
                  value === c.value ? "border-current shadow-sm" : "hover:bg-muted/60"
                )}
                style={value === c.value ? { borderColor: p.accent, background: `color-mix(in srgb, ${p.accent} 8%, transparent)` } : undefined}
              >
                <RadioGroupItem value={c.value} className="sr-only" />
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                  style={value === c.value ? { borderColor: p.accent } : { borderColor: "var(--border)" }}
                >
                  {value === c.value && <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />}
                </span>
                {c.label}
              </label>
            ))}
          </RadioGroup>
          {selectedChoice?.allowText && (
            <Input
              className="mt-2.5 h-12 text-[15px]"
              placeholder="Précisez…"
              value={p.otherValue}
              onChange={(e) => p.onOtherChange(e.target.value)}
              onBlur={p.onBlur}
            />
          )}
        </div>
      );
    }

    case "multiple_choice": {
      const choices = f.options.choices ?? [];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2.5" aria-describedby={p.error ? `err-${f.key}` : undefined}>
          {choices.map((c) => {
            const checked = arr.includes(c.value);
            return (
              <div key={c.value}>
                <label
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-all duration-150",
                    checked ? "border-current shadow-sm" : "hover:bg-muted/60"
                  )}
                  style={checked ? { borderColor: p.accent, background: `color-mix(in srgb, ${p.accent} 8%, transparent)` } : undefined}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      const next = checked ? arr.filter((x) => x !== c.value) : [...arr, c.value];
                      p.onChange(next);
                      p.onBlur();
                    }}
                    className="sr-only"
                  />
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
                    style={checked ? { borderColor: p.accent, background: p.accent } : { borderColor: "var(--border)" }}
                  >
                    {checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </span>
                  {c.label}
                </label>
                {checked && c.allowText && (
                  <Input
                    className="ml-4 mt-2 h-11 w-[calc(100%-1rem)] text-[15px]"
                    placeholder="Précisez…"
                    value={p.otherValue}
                    onChange={(e) => p.onOtherChange(e.target.value)}
                    onBlur={p.onBlur}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "dropdown": {
      const choices = f.options.choices ?? [];
      return (
        <Select value={(value as string) ?? ""} onValueChange={(v) => { p.onChange(v); p.onBlur(); }}>
          <SelectTrigger id={id} className={cn(common, "w-full")} aria-invalid={!!p.error}>
            <SelectValue placeholder="Sélectionnez…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {choices.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "consent": {
      const checked = value === true;
      return (
        <label
          className={cn(
            "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 text-[14px] leading-relaxed transition-all duration-150",
            checked ? "border-current" : "hover:bg-muted/60"
          )}
          style={checked ? { borderColor: p.accent, background: `color-mix(in srgb, ${p.accent} 6%, transparent)` } : undefined}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => { p.onChange(v === true); p.onBlur(); }}
            className="mt-0.5"
            aria-invalid={!!p.error}
          />
          <span>{f.options.consentText || f.label}</span>
        </label>
      );
    }

    case "rating_stars": {
      const max = f.options.maxValue ?? 5;
      const n = Number(value ?? 0);
      return (
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label={f.label}>
          {Array.from({ length: max }, (_, i) => i + 1).map((i) => (
            <button
              key={i}
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-lg transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() => { p.onChange(i); p.onBlur(); }}
              aria-label={`${i} sur ${max}`}
            >
              <Star
                className="h-8 w-8 transition-colors"
                style={i <= n ? { fill: p.accent, color: p.accent } : { fill: "transparent", color: "var(--border)" }}
              />
            </button>
          ))}
          {n > 0 && <span className="ml-2 text-sm text-muted-foreground">{n} sur {max}</span>}
        </div>
      );
    }

    case "number_scale":
    case "nps": {
      const min = f.options.min ?? 0;
      const max = f.options.maxValue ?? f.options.max ?? 10;
      const n = value === null || value === undefined || value === "" ? null : Number(value);
      return (
        <div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label}>
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  "h-12 w-12 min-w-12 rounded-xl border text-[15px] font-medium transition-all duration-150 hover:scale-105",
                  n === i ? "text-white shadow-md" : "hover:bg-muted"
                )}
                style={n === i ? { background: p.accent, borderColor: p.accent } : undefined}
                onClick={() => { p.onChange(i); p.onBlur(); }}
                aria-pressed={n === i}
              >
                {i}
              </button>
            ))}
          </div>
          {f.options.labels?.left || f.options.labels?.right ? (
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{f.options.labels?.left}</span>
              <span>{f.options.labels?.right}</span>
            </div>
          ) : null}
        </div>
      );
    }

    case "likert": {
      const levels = f.options.levels ?? 5;
      const labels = LIKERT_LABELS[levels] ?? LIKERT_LABELS[5];
      const n = value === null || value === undefined || value === "" ? null : Number(value);
      return (
        <div className="space-y-2.5" role="radiogroup" aria-label={f.label}>
          {labels.map((label, i) => {
            const v = i + 1;
            const active = n === v;
            return (
              <label
                key={v}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-all duration-150",
                  active ? "border-current shadow-sm" : "hover:bg-muted/60"
                )}
                style={active ? { borderColor: p.accent, background: `color-mix(in srgb, ${p.accent} 8%, transparent)` } : undefined}
              >
                <input
                  type="radio"
                  name={id}
                  className="sr-only"
                  checked={active}
                  onChange={() => { p.onChange(v); p.onBlur(); }}
                />
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                  style={active ? { borderColor: p.accent } : { borderColor: "var(--border)" }}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />}
                </span>
                {label}
              </label>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}
