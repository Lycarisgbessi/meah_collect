"use client";

// ============================================================
// SettingsPage — écran 11 (A-06, A-07, §8.3) : profil, sécurité,
// préférences de notification, suppression de compte (RGPD).
// ============================================================

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import { useAppRouter } from "@/lib/router";
import { toast } from "sonner";
import { Loader2, UserRound, Bell, KeyRound, Trash2, ShieldCheck } from "lucide-react";

const TIMEZONES = ["UTC", "Europe/Paris", "Europe/London", "Africa/Conakry", "Africa/Abidjan", "Africa/Dakar", "America/New_York", "America/Montreal"];

export function SettingsPage() {
  const { user, refreshMe, logout } = useApp();
  const { navigate } = useAppRouter();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [locale, setLocale] = useState(user?.locale ?? "fr");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notifyOnResponse, setNotifyOnResponse] = useState(user?.notifyOnResponse ?? true);
  const [notifyOnMember, setNotifyOnMember] = useState(user?.notifyOnMember ?? true);
  const [dailyDigest, setDailyDigest] = useState(user?.dailyDigest ?? false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/api/auth/profile", { firstName, lastName, locale, timezone });
      await refreshMe();
      toast.success("Profil mis à jour.");
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setSaving(true);
    try {
      await api.patch("/api/auth/profile", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Mot de passe modifié. Vos autres sessions ont été déconnectées.");
    } catch (err) {
      const e = err as { fields?: Record<string, string> };
      toast.error(e.fields?.currentPassword ?? e.fields?.newPassword ?? "Modification impossible.");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifs = async (patch: Record<string, boolean>) => {
    try {
      await api.patch("/api/auth/profile", patch);
      await refreshMe();
      toast.success("Préférences enregistrées.");
    } catch {
      toast.error("Enregistrement impossible.");
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/api/auth/profile");
      await logout();
      navigate({ name: "landing" }, { replace: true });
      toast.success("Compte supprimé. Vos données personnelles ont été anonymisées immédiatement.");
    } catch {
      toast.error("Suppression impossible.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Paramètres</h1>
      <p className="mt-1 text-muted-foreground">Profil, sécurité et préférences de notification.</p>

      <Card className="mt-8 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-4.5 w-4.5 text-primary" /> Mon profil</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-first">Prénom</Label>
              <Input id="s-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-last">Nom</Label>
              <Input id="s-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">E-mail</Label>
              <Input id="s-email" value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Langue</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Fuseau horaire</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="mt-5" onClick={saveProfile} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
          </Button>
          {!user.emailVerified && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Votre e-mail n'est pas vérifié — vérifiez-le depuis l'écran de connexion pour activer votre lien de collecte.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4.5 w-4.5 text-primary" /> Sécurité</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-cur">Mot de passe actuel</Label>
              <Input id="s-cur" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-new">Nouveau mot de passe</Label>
              <Input id="s-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="8 caractères minimum" />
            </div>
          </div>
          <Button className="mt-5" variant="outline" onClick={savePassword} disabled={saving || !newPassword || !currentPassword}>
            Modifier le mot de passe
          </Button>
          <Separator className="my-5" />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Session sécurisée 30 jours · Mots de passe hachés (scrypt) · Déconnexion de tous les appareils en changeant le mot de passe.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Bell className="h-4.5 w-4.5 text-primary" /> Notifications</h2>
          <div className="mt-5 space-y-4">
            <ToggleRow
              label="Nouvelle réponse"
              desc="Être notifié à chaque réponse collectée via mes liens (E6)."
              checked={notifyOnResponse}
              onChange={(v) => { setNotifyOnResponse(v); saveNotifs({ notifyOnResponse: v }); }}
            />
            <ToggleRow
              label="Nouveau membre"
              desc="Être notifié quand quelqu'un rejoint une de mes équipes (E5)."
              checked={notifyOnMember}
              onChange={(v) => { setNotifyOnMember(v); saveNotifs({ notifyOnMember: v }); }}
            />
            <ToggleRow
              label="Résumé quotidien"
              desc="Un e-mail récapitulatif par jour avec les chiffres clés (E7)."
              checked={dailyDigest}
              onChange={(v) => { setDailyDigest(v); saveNotifs({ dailyDigest: v }); }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl border-destructive/30">
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="h-4.5 w-4.5" /> Supprimer mon compte</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vos données personnelles (nom, e-mail, photo) sont anonymisées immédiatement et votre compte est désactivé. Les réponses déjà collectées restent la propriété des initiateurs concernés.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4">Supprimer définitivement</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Vos données personnelles sont anonymisées immédiatement (RGPD) et le compte est désactivé sans délai.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-white hover:bg-destructive/90">Oui, supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
