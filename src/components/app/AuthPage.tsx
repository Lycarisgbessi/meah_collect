"use client";

// ============================================================
// AuthPage — écran 2 (F.2) : inscription, connexion, vérification,
// mot de passe oublié / réinitialisation. Split-screen élégant.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { useAppRouter } from "@/lib/router";
import { passwordStrength } from "@/lib/crypto-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck, Zap, Users,
  ClipboardCheck, BarChart3,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/Logo";
import type { AppView } from "@/lib/types";
import { takeIntendedView } from "@/lib/router";

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";

interface AuthView {
  name: "auth";
  mode: Mode;
  token?: string;
  inviteToken?: string;
}

const RESET_TOKEN_KEY = "meah-collect:reset-token";

export function AuthPage({ view }: { view: AuthView }) {
  const { navigate } = useAppRouter();
  const { refreshMe } = useApp();
  const [mode, setMode] = useState<Mode>(view.mode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // champs
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState(view.token ?? "");

  // Synchronisation du mode quand l'URL change (bouton retour/avant)
  useEffect(() => {
    setMode(view.mode);
    if (view.mode === "reset" && view.token) setResetToken(view.token);
  }, [view.mode, view.token]);

  // Compte à rebours du renvoi de code
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthLabels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"];
  const strengthColors = ["bg-destructive", "bg-destructive/70", "bg-amber-500", "bg-lime-600", "bg-emerald-600"];

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setFieldErrors({});
    setNotice(null);
    navigate({ name: "auth", mode: m, inviteToken: view.inviteToken }, { replace: true });
  };

  /** Après connexion : retour à la vue demandée initialement, sinon le tableau de bord. */
  const navigateAfterAuth = (fallback: AppView, replace = true) => {
    const intended = takeIntendedView();
    navigate(intended ?? fallback, { replace });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setFieldErrors({ confirmPassword: "Les mots de passe ne correspondent pas." });
          setLoading(false);
          return;
        }
        const res = await api.post<{
          needsVerification: boolean;
          inviteInvalid?: boolean;
          joined?: { slug: string; formTitle: string; formId: string };
        }>("/api/auth/signup", { firstName, lastName, email, password, acceptTerms, inviteToken: view.inviteToken });
        if (res.joined) {
          await refreshMe();
          toast.success(`Bienvenue ! Vous avez rejoint l'équipe « ${res.joined.formTitle} ». Votre lien personnel est prêt.`, { duration: 5000 });
          navigate({ name: "memberSpace", formId: res.joined.formId }, { replace: true });
        } else {
          await refreshMe();
          if (res.inviteInvalid) toast.warning("Votre lien d'invitation semblait invalide — le compte a été créé sans équipe.");
          switchMode("verify");
          setNotice("Un code de vérification vous a été envoyé par e-mail. Saisissez-le ci-dessous.");
        }
        return;
      }
      if (mode === "login") {
        const res = await api.post<{ needsVerification: boolean; joined?: { slug: string; formId: string } }>(
          "/api/auth/login",
          { email, password, inviteToken: view.inviteToken }
        );
        await refreshMe();
        if (res.needsVerification) {
          switchMode("verify");
          setNotice("Votre e-mail n'est pas encore vérifié. Saisissez le code reçu pour débloquer toutes les fonctions.");
        } else if (res.joined) {
          toast.success(`Vous avez rejoint l'équipe avec votre compte existant.`, { duration: 4000 });
          navigate({ name: "memberSpace", formId: res.joined.formId }, { replace: true });
        } else {
          navigateAfterAuth({ name: "dashboard" });
        }
        return;
      }
      if (mode === "verify") {
        await api.post("/api/auth/verify", { code });
        await refreshMe();
        toast.success("E-mail vérifié ✓");
        navigateAfterAuth({ name: "dashboard" });
        return;
      }
      if (mode === "forgot") {
        await api.post("/api/auth/forgot", { email });
        switchMode("reset");
        setNotice("Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé (jeton valable 1 h). Saisissez le jeton reçu ci-dessous.");
        return;
      }
      if (mode === "reset") {
        const token = (view.token || resetToken || window.sessionStorage.getItem(RESET_TOKEN_KEY) || "").trim();
        if (!token) {
          setFieldErrors({ resetToken: "Saisissez le jeton reçu par e-mail." });
          setLoading(false);
          return;
        }
        await api.post("/api/auth/reset", { token, password });
        window.sessionStorage.removeItem(RESET_TOKEN_KEY);
        await refreshMe();
        toast.success("Mot de passe mis à jour. Vous êtes connecté.");
        navigateAfterAuth({ name: "dashboard" });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Une erreur inattendue est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (cooldown > 0) return;
    try {
      await api.post("/api/auth/resend");
      setCooldown(60);
      setNotice("Un nouveau code vient de vous être envoyé par e-mail.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du renvoi.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Panneau visuel — promesse */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#161310] p-12 text-[#efe8db] lg:flex">
        <div className="hero-grain absolute inset-0 opacity-40" />
        <div className="relative">
          <BrandLogo size={40} />
          <p className="font-display mt-4 text-lg font-semibold tracking-wide">MEAH COLLECT</p>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-balance">
            Un formulaire. Votre équipe. Autant de liens que de collecteurs.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-[#cfc6b6]">
            {[
              { icon: Users, text: "Invitez votre équipe, chaque membre reçoit son lien personnel" },
              { icon: ClipboardCheck, text: "Traçabilité totale : chaque réponse est rattachée à son collecteur" },
              { icon: BarChart3, text: "Tableaux de bord individuels et exports Excel, PDF, CSV" },
              { icon: Zap, text: "Remplissage en moins d'une minute, sur mobile" },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#c9a76f]" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#8a8171]">Conforme RGPD · Données chiffrées · Hébergement maîtrisé</p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandLogo size={36} />
            <span className="font-display text-lg font-semibold tracking-wide">MEAH COLLECT</span>
          </div>

          {view.inviteToken && (mode === "signup" || mode === "login") && (
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium">Vous rejoignez l'équipe d'un initiateur</p>
              <p className="mt-0.5 text-muted-foreground">Créez votre compte pour recevoir votre lien personnel.</p>
            </div>
          )}

          {mode === "signup" && <Header title="Créer mon compte" sub="Prénom, nom, e-mail — et c'est parti." />}
          {mode === "login" && <Header title="Bon retour" sub="Connectez-vous pour accéder à vos collectes." />}
          {mode === "verify" && <Header title="Vérifiez votre e-mail" sub="Saisissez le code à 6 chiffres reçu." />}
          {mode === "forgot" && <Header title="Mot de passe oublié" sub="Nous vous envoyons un jeton sécurisé (valable 1 h)." />}
          {mode === "reset" && <Header title="Nouveau mot de passe" sub="Collez le jeton reçu et choisissez un mot de passe robuste." />}

          {notice && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-foreground">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-invalid={!!fieldErrors.firstName} />
                  <FieldErr msg={fieldErrors.firstName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-invalid={!!fieldErrors.lastName} />
                  <FieldErr msg={fieldErrors.lastName} />
                </div>
              </div>
            )}

            {(mode === "signup" || mode === "login" || mode === "forgot") && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="nom@domaine.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} />
                <FieldErr msg={fieldErrors.email} />
              </div>
            )}

            {mode === "reset" && !view.token && (
              <div className="space-y-1.5">
                <Label htmlFor="resetToken">Jeton de réinitialisation</Label>
                <Input
                  id="resetToken"
                  autoComplete="one-time-code"
                  placeholder="Collez le jeton reçu par e-mail"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  aria-invalid={!!fieldErrors.resetToken}
                  className="font-mono text-xs"
                />
                <FieldErr msg={fieldErrors.resetToken} />
              </div>
            )}

            {(mode === "signup" || mode === "login" || mode === "reset") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-primary hover:underline">
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.password}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode !== "login" && password.length > 0 && (
                  <div className="pt-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < Math.max(strength, 1) ? strengthColors[strength] : "bg-muted")} />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Robustesse : {strengthLabels[strength]}</p>
                  </div>
                )}
                <FieldErr msg={fieldErrors.password} />
              </div>
            )}

            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmation du mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.confirmPassword}
                  />
                  <FieldErr msg={fieldErrors.confirmPassword} />
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
                  <label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground">
                    J&apos;accepte les <span className="text-foreground underline underline-offset-2">conditions générales</span> et la{" "}
                    <span className="text-foreground underline underline-offset-2">politique de confidentialité</span>.
                  </label>
                </div>
                <FieldErr msg={fieldErrors.acceptTerms} />
              </>
            )}

            {mode === "verify" && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Code de vérification</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  className="h-14 text-center text-2xl tracking-[0.5em]"
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <FieldErr msg={fieldErrors.code} />
              </div>
            )}

            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" && "Créer mon compte"}
              {mode === "login" && "Se connecter"}
              {mode === "verify" && "Valider mon e-mail"}
              {mode === "forgot" && "Envoyer le lien"}
              {mode === "reset" && "Définir le mot de passe"}
            </Button>

            {mode === "verify" && (
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={resendCode} disabled={cooldown > 0}>
                {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
              </Button>
            )}
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            {mode !== "signup" && mode !== "verify" && mode !== "reset" && (
              <p>
                Pas encore de compte ?{" "}
                <button onClick={() => switchMode("signup")} className="font-medium text-primary hover:underline">
                  Créer mon compte
                </button>
              </p>
            )}
            {mode === "verify" && (
              <button onClick={async () => { await refreshMe(); navigateAfterAuth({ name: "dashboard" }); }} className="text-primary hover:underline">
                Continuer vers mon espace (vérification possible plus tard)
              </button>
            )}
            {mode !== "login" && mode !== "reset" && (
              <p>
                Vous avez déjà un compte ?{" "}
                <button onClick={() => switchMode("login")} className="font-medium text-primary hover:underline">
                  Se connecter
                </button>
              </p>
            )}
          </div>

          <button
            onClick={() => navigate({ name: "landing" }, { replace: true })}
            className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour à l&apos;accueil
          </button>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5" /> Connexion chiffrée · Session sécurisée 30 jours
          </p>
        </div>
      </main>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
