"use client";

// ============================================================
// SharePublish — écran 5 (F.4 publication) + C-01/C-08 :
// deux liens (invitation équipe + lien de collecte personnel),
// QR codes, boutons de partage, réglages de collecte, états du formulaire.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useAppRouter } from "@/lib/router";
import { publicFormUrl, inviteUrl } from "@/lib/router";
import type { InvitationDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  ArrowLeft, Copy, Check, QrCode, Download, Users, Link2, Eye, RotateCcw,
  Ban, Archive, ArchiveRestore, PlayCircle, PauseCircle, Share2, MessageCircle,
  Mail, Phone, Settings2, Loader2, Sparkles, AlertTriangle, Pencil,
} from "lucide-react";

interface FormDetail {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  displayMode: string;
  myRole: "owner" | "member";
  settings: {
    finalMessage?: string;
    closesAt?: string | null;
    maxSubmissions?: number | null;
    dedup?: { enabled: boolean; keys: ("email" | "phone")[]; mode: "block" | "warn" };
    allowAnother?: boolean;
    notifyOwner?: boolean;
    notifyMember?: boolean;
    estimateMinutes?: number;
  };
  myLink: { slug: string; isActive: boolean } | null;
  ownerName: string;
}

export function SharePublish({ formId }: { formId: string }) {
  const { navigate } = useAppRouter();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [invitation, setInvitation] = useState<InvitationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<{ url: string; title: string } | null>(null);
  const [checklist, setChecklist] = useState<{ issues: string[]; warnings: string[] } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [settings, setSettings] = useState<FormDetail["settings"]>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = await api.get<FormDetail>(`/api/forms/${formId}`);
      // Écran réservé à l'initiateur : un membre est redirigé vers son espace.
      if (f.myRole === "member") {
        toast.info("Cette page est réservée à l'initiateur.");
        navigate({ name: "memberSpace", formId }, { replace: true });
        return;
      }
      setForm(f);
      setSettings(f.settings ?? {});
      if (f.myRole === "owner") {
        const inv = await api.get<{ invitations: InvitationDTO[] }>(`/api/forms/${formId}/invitation`);
        setInvitation(inv.invitations.find((i) => i.isActive) ?? inv.invitations[0] ?? null);
      }
    } catch {
      toast.error("Impossible de charger le formulaire.");
    } finally {
      setLoading(false);
    }
  }, [formId, navigate]);

  useEffect(() => { load(); }, [load]);

  const copy = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      toast.success("Lien copié ✓");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez le lien manuellement.");
    }
  };

  const regenerateInvitation = async () => {
    try {
      const res = await api.post<{ invitation: InvitationDTO }>(`/api/forms/${formId}/invitation`);
      setInvitation(res.invitation);
      toast.success("Nouveau lien d'invitation généré. L'ancien est invalidé.");
    } catch {
      toast.error("Régénération impossible.");
    }
  };

  const revokeInvitation = async () => {
    if (!invitation) return;
    try {
      await api.delete(`/api/forms/${formId}/invitation?invitationId=${invitation.id}`);
      setInvitation(null);
      toast.success("Lien d'invitation révoqué.");
    } catch {
      toast.error("Révocation impossible.");
    }
  };

  const updateInvitation = async (patch: { expiresAt?: string | null; maxUses?: number | null }) => {
    if (!invitation) return;
    try {
      const res = await api.patch<{ invitation: InvitationDTO }>(`/api/forms/${formId}/invitation`, { invitationId: invitation.id, ...patch });
      setInvitation(res.invitation);
      toast.success("Options mises à jour.");
    } catch {
      toast.error("Mise à jour impossible.");
    }
  };

  const tryPublish = async () => {
    setPublishing(true);
    try {
      await api.post(`/api/forms/${formId}/publish`, { action: "publish" });
      toast.success("Formulaire publié — vos liens sont actifs.");
      await load();
    } catch (err) {
      const e = err as { code?: string; message?: string; fields?: { issues?: string[] } };
      if (e.code === "PUBLICATION_CHECK") {
        const issues = (e.fields?.issues as unknown as string[]) ?? [e.message ?? "Checklist non validée."];
        setChecklist({ issues, warnings: [] });
      } else {
        toast.error(e.message ?? "Publication impossible.");
      }
    } finally {
      setPublishing(false);
    }
  };

  const transition = async (action: string, label: string) => {
    try {
      await api.post(`/api/forms/${formId}/publish`, { action });
      toast.success(label);
      await load();
    } catch {
      toast.error("Action impossible.");
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.patch(`/api/forms/${formId}`, { settings });
      toast.success("Réglages enregistrés.");
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setSavingSettings(false);
    }
  };

  const downloadQr = async (url: string, name: string) => {
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#211d17", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${name}.png`;
    a.click();
    toast.success("QR code téléchargé.");
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (!form) return null;

  const invUrl = invitation ? inviteUrl(invitation.token) : "";
  const myUrl = form.myLink ? publicFormUrl(form.myLink.slug) : "";

  const shareMessage = form.myLink
    ? `Bonjour, merci de remplir ce formulaire : ${myUrl}`
    : `Bonjour, rejoignez mon équipe de collecte : ${invUrl}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <button onClick={() => navigate({ name: "dashboard" })} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mes formulaires
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{form.title}</h1>
        <StatusBadge status={form.status} />
      </div>

      {/* Actions d'état (B-09 / Annexe B.1) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {form.status === "draft" && (
          <Button className="h-10" onClick={tryPublish} disabled={publishing}>
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Publier et obtenir mes liens
          </Button>
        )}
        {form.status === "published" && (
          <>
            <Button variant="outline" className="h-10" onClick={() => transition("close", "Formulaire clôturé.")}>
              <PauseCircle className="mr-2 h-4 w-4" /> Clôturer
            </Button>
            <Button variant="outline" className="h-10" onClick={() => transition("unpublish", "Formulaire dépublié.")}>
              <Ban className="mr-2 h-4 w-4" /> Dépublier
            </Button>
          </>
        )}
        {form.status === "closed" && (
          <>
            <Button className="h-10" onClick={() => transition("reopen", "Formulaire rouvert.")}>
              <PlayCircle className="mr-2 h-4 w-4" /> Rouvrir
            </Button>
            <Button variant="outline" className="h-10" onClick={() => transition("archive", "Formulaire archivé.")}>
              <Archive className="mr-2 h-4 w-4" /> Archiver
            </Button>
          </>
        )}
        {form.status === "archived" && (
          <Button variant="outline" className="h-10" onClick={() => transition("restore", "Formulaire restauré.")}>
            <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurer
          </Button>
        )}
        <Button variant="ghost" className="h-10" onClick={() => navigate({ name: "builder", formId })}>
          <Pencil className="mr-2 h-4 w-4" /> Modifier le formulaire
        </Button>
      </div>

      {/* Aperçu */}
      <div className="mt-6 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-9"
          onClick={() => {
            if (form.status === "published" && form.myLink) window.open(publicFormUrl(form.myLink.slug), "_blank");
            else if (form.status === "draft") toast.info("Publiez le formulaire pour voir l'aperçu public.");
            else toast.info("Ce formulaire n'accepte plus de réponses.");
          }}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" /> Aperçu public
        </Button>
        <Button variant="secondary" size="sm" className="h-9" onClick={() => navigate({ name: "team", formId })}>
          <Users className="mr-1.5 h-3.5 w-3.5" /> Gérer l'équipe
        </Button>
        <Button variant="secondary" size="sm" className="h-9" onClick={() => navigate({ name: "responses", formId, scope: "all" })}>
          Voir les réponses
        </Button>
      </div>

      {/* Lien d'invitation équipe (C-01) */}
      <Card className="mt-8 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-4.5 w-4.5" /></span>
            <div>
              <h2 className="font-semibold">Lien d'invitation équipe</h2>
              <p className="text-xs text-muted-foreground">Vos collaborateurs créent leur compte et reçoivent chacun leur lien dérivé.</p>
            </div>
          </div>

          {form.status !== "published" && form.status !== "closed" ? (
            <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              Publiez le formulaire pour activer le lien d'invitation.
            </p>
          ) : invitation ? (
            <>
              <div className="mt-4 flex items-center gap-2">
                <code className="h-11 flex-1 truncate rounded-lg border border-input bg-muted/50 px-3 text-[13px] leading-[2.75rem]">{invUrl}</code>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => copy(invUrl, "invite")} aria-label="Copier le lien d'invitation">
                  {copied === "invite" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setQrOpen({ url: invUrl, title: "Invitation équipe" })} aria-label="QR code">
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {invitation.expiresAt && <Badge variant="outline">Expire le {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}</Badge>}
                {invitation.maxUses !== null && invitation.maxUses !== undefined && <Badge variant="outline">{invitation.usesCount}/{invitation.maxUses} inscriptions</Badge>}
                {invitation.maxUses === null && <Badge variant="outline">{invitation.usesCount} inscription(s)</Badge>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ShareButtons url={invUrl} message={`Rejoins mon équipe de collecte « ${form.title} » : ${invUrl}`} />
              </div>
              <Accordion type="single" collapsible className="mt-4">
                <AccordionItem value="options" className="border-0">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline">Options du lien (expiration, quota, révocation)</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="inv-exp">Expiration</Label>
                        <Input
                          id="inv-exp"
                          type="date"
                          value={invitation.expiresAt ? invitation.expiresAt.slice(0, 10) : ""}
                          onChange={(e) => updateInvitation({ expiresAt: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="inv-max">Nombre max d'inscriptions</Label>
                        <Input
                          id="inv-max"
                          type="number"
                          min={1}
                          placeholder="Illimité"
                          defaultValue={invitation.maxUses ?? ""}
                          onBlur={(e) => updateInvitation({ maxUses: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                      <div className="flex items-end gap-2 sm:col-span-2">
                        <Button variant="outline" size="sm" onClick={regenerateInvitation}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Régénérer (invalide l'ancien)</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Ban className="mr-1.5 h-3.5 w-3.5" /> Révoquer</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Révoquer ce lien d'invitation ?</AlertDialogTitle>
                              <AlertDialogDescription>Personne ne pourra plus rejoindre l'équipe avec ce lien. Vous pourrez en générer un nouveau. Les membres déjà inscrits ne sont pas affectés.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={revokeInvitation}>Révoquer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            <Button className="mt-4" onClick={regenerateInvitation}>
              <Link2 className="mr-2 h-4 w-4" /> Générer le lien d'invitation
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Lien de collecte personnel (C-08) */}
      {form.myLink && (
        <Card className="mt-4 rounded-2xl border-border/80">
          <CardContent className="p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Share2 className="h-4.5 w-4.5" /></span>
              <div>
                <h2 className="font-semibold">Mon lien de collecte</h2>
                <p className="text-xs text-muted-foreground">Votre lien personnel : chaque réponse est rattachée à votre nom.</p>
              </div>
              {!form.myLink.isActive && <Badge variant="destructive">Inactif</Badge>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <code className="h-11 flex-1 truncate rounded-lg border border-input bg-muted/50 px-3 text-[13px] leading-[2.75rem]">{myUrl}</code>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => copy(myUrl, "mine")} aria-label="Copier mon lien">
                {copied === "mine" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setQrOpen({ url: myUrl, title: "Mon lien" })} aria-label="QR code">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3">
              <ShareButtons url={myUrl} message={`Bonjour, remplissez ce formulaire : ${myUrl}`} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Réglages de collecte (B-11) */}
      <Card className="mt-4 rounded-2xl border-border/80">
        <CardContent className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Settings2 className="h-4.5 w-4.5" /></span>
            <h2 className="font-semibold">Réglages de collecte</h2>
          </div>
          <div className="mt-5 grid gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="final-msg">Message de remerciement</Label>
              <Textarea
                id="final-msg"
                rows={2}
                value={settings.finalMessage ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, finalMessage: e.target.value }))}
                placeholder="Merci ! Vos informations ont bien été envoyées."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="closes-at">Date de clôture (optionnelle)</Label>
                <Input
                  id="closes-at"
                  type="date"
                  value={settings.closesAt ? settings.closesAt.slice(0, 10) : ""}
                  onChange={(e) => setSettings((s) => ({ ...s, closesAt: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-sub">Limite de réponses (optionnelle)</Label>
                <Input
                  id="max-sub"
                  type="number"
                  min={1}
                  placeholder="Illimité"
                  value={settings.maxSubmissions ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, maxSubmissions: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Détection de doublons</p>
                <p className="text-xs text-muted-foreground">Refuser une réponse si l'e-mail ou le téléphone a déjà été enregistré.</p>
              </div>
              <Switch
                checked={settings.dedup?.enabled ?? false}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, dedup: { enabled: v, keys: s.dedup?.keys ?? ["email"], mode: s.dedup?.mode ?? "block" } }))}
              />
            </div>
            {settings.dedup?.enabled && (
              <div className="flex flex-wrap items-center gap-2 pl-1">
                <Button
                  size="sm"
                  variant={settings.dedup.keys.includes("email") ? "secondary" : "outline"}
                  onClick={() => setSettings((s) => {
                    const keys = s.dedup?.keys ?? [];
                    return { ...s, dedup: { ...s.dedup!, keys: keys.includes("email") ? keys.filter((k) => k !== "email") : [...keys, "email"] } };
                  })}
                >Par e-mail</Button>
                <Button
                  size="sm"
                  variant={settings.dedup.keys.includes("phone") ? "secondary" : "outline"}
                  onClick={() => setSettings((s) => {
                    const keys = s.dedup?.keys ?? [];
                    return { ...s, dedup: { ...s.dedup!, keys: keys.includes("phone") ? keys.filter((k) => k !== "phone") : [...keys, "phone"] } };
                  })}
                >Par téléphone</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSettings((s) => ({ ...s, dedup: { ...s.dedup!, mode: s.dedup?.mode === "block" ? "warn" : "block" } }))}
                >Mode : {settings.dedup.mode === "block" ? "Bloquer" : "Avertir seulement"}</Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Bouton « Remplir un autre formulaire »</p>
                <p className="text-xs text-muted-foreground">Utile pour la collecte en événement (mode kiosque).</p>
              </div>
              <Switch
                checked={settings.allowAnother ?? false}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, allowAnother: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Notification à chaque nouvelle réponse</p>
                <p className="text-xs text-muted-foreground">Vous recevez une notification in-app et un e-mail (E6).</p>
              </div>
              <Switch
                checked={settings.notifyOwner ?? true}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, notifyOwner: v }))}
              />
            </div>
          </div>
          <Button className="mt-6" onClick={saveSettings} disabled={savingSettings}>
            {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer les réglages
          </Button>
        </CardContent>
      </Card>

      {/* Modale QR */}
      <Dialog open={!!qrOpen} onOpenChange={(o) => !o && setQrOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">QR code — {qrOpen?.title}</DialogTitle>
            <DialogDescription>Imprimez-le ou partagez-le : il ouvre le lien sur mobile.</DialogDescription>
          </DialogHeader>
          {qrOpen && (
            <div className="flex flex-col items-center gap-4">
              <QrImage url={qrOpen.url} />
              <Button variant="outline" onClick={() => downloadQr(qrOpen.url, qrOpen.title)}>
                <Download className="mr-2 h-4 w-4" /> Télécharger le PNG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modale checklist publication (F.4) */}
      <Dialog open={!!checklist} onOpenChange={(o) => !o && setChecklist(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Publication impossible
            </DialogTitle>
            <DialogDescription>Corrigez ces points avant de publier :</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {checklist?.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> {issue}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
    published: { label: "Publié", className: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
    closed: { label: "Clôturé", className: "bg-amber-600/10 text-amber-700 dark:text-amber-400" },
    archived: { label: "Archivé", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? map.draft;
  return <Badge className={cn("text-[11px]", s.className)}>{s.label}</Badge>;
}

export function QrImage({ url, size = 208 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { width: size * 2, margin: 2, color: { dark: "#211d17", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url, size]);
  if (!src) return <Skeleton style={{ width: size, height: size }} className="rounded-xl" />;
   
  return <img src={src} alt={`QR code vers ${url}`} width={size} height={size} className="rounded-xl border bg-white p-2" />;
}

export function ShareButtons({ url, message }: { url: string; message: string }) {
  const enc = encodeURIComponent;
  const btns = [
    { icon: MessageCircle, label: "WhatsApp", href: `https://wa.me/?text=${enc(message)}`, color: "text-emerald-600" },
    { icon: Mail, label: "E-mail", href: `mailto:?subject=${enc("Formulaire à remplir")}&body=${enc(message)}`, color: "text-primary" },
    { icon: Phone, label: "SMS", href: `sms:?&body=${enc(message)}`, color: "text-foreground" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {btns.map((b) => (
        <a
          key={b.label}
          href={b.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 px-3 text-xs font-medium transition-colors hover:bg-muted"
        >
          <b.icon className={cn("h-3.5 w-3.5", b.color)} /> {b.label}
        </a>
      ))}
      <button
        onClick={() => {
          if (navigator.share) navigator.share({ title: "Formulaire", url, text: message }).catch(() => {});
          else copyToClipboard(url);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 px-3 text-xs font-medium transition-colors hover:bg-muted"
      >
        <Share2 className="h-3.5 w-3.5" /> Partager
      </button>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Lien copié ✓")).catch(() => {});
}
