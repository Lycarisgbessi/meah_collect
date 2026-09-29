"use client";

// ============================================================
// AppShell — en-tête applicatif (écran 3) : logo, navigation,
// notifications (cloche Annexe G), menu utilisateur, thème clair/sombre.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { useAppRouter } from "@/lib/router";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, LogOut, Settings, ShieldCheck, LayoutDashboard, Moon, Sun, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand/Logo";
import { useTheme } from "next-themes";

interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, unreadNotifications, setUnread } = useApp();
  const { view, navigate } = useAppRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Notifications : rechargées au changement de vue, au plus toutes les 60 s (évite le spam de requêtes).
  const lastNotifFetchRef = useRef(0);
  useEffect(() => {
    let alive = true;
    const now = Date.now();
    if (now - lastNotifFetchRef.current < 60_000) return;
    lastNotifFetchRef.current = now;
    api.get<{ unread: number; items: NotificationItem[] }>("/api/notifications")
      .then((d) => {
        if (!alive) return;
        setUnread(d.unread);
        setNotifs(d.items);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [setUnread, view]);

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "?";

  const markAllRead = async () => {
    try {
      await api.post("/api/notifications");
      setUnread(0);
      setNotifs((n) => n.map((x) => ({ ...x, readAt: new Date().toISOString() })));
    } catch {}
  };

  const notifLabel = (n: NotificationItem): { title: string; detail: string } => {
    const p = n.payload as { memberName?: string; formTitle?: string; summary?: { label: string; value: string }[]; rowCount?: number };
    switch (n.type) {
      case "member_joined":
        return { title: `${p.memberName ?? "Quelqu'un"} a rejoint votre équipe`, detail: p.formTitle ?? "" };
      case "new_submission":
        return {
          title: "Nouvelle réponse reçue",
          detail: [p.formTitle, ...(p.summary ?? []).map((s) => `${s.label} : ${s.value}`)].filter(Boolean).slice(0, 3).join(" · "),
        };
      case "export_ready":
        return { title: "Votre export est prêt", detail: `${p.rowCount ?? 0} ligne(s) — disponible 24 h` };
      default:
        return { title: "Notification", detail: "" };
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); navigate({ name: "dashboard" }); }}
            className="flex items-center gap-2.5"
          >
            <BrandLogo size={36} />
            <span className="font-display text-lg font-semibold tracking-wide">MEAH COLLECT</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            <NavTab active={view.name === "dashboard"} onClick={() => navigate({ name: "dashboard" })}>
              <LayoutDashboard className="h-4 w-4" /> Accueil
            </NavTab>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Basculer le thème"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-10 w-10"
            >
              {mounted && resolvedTheme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </Button>

            {/* Notifications in-app */}
            <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o && unreadNotifications > 0) markAllRead(); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={`Notifications (${unreadNotifications} non lues)`}>
                  <Bell className="h-4.5 w-4.5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  <span className="text-xs text-muted-foreground">{unreadNotifications} non lue(s)</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune notification pour l'instant.</p>
                  ) : (
                    notifs.map((n) => {
                      const { title, detail } = notifLabel(n);
                      return (
                        <div key={n.id} className={cn("border-b px-4 py-3 text-sm last:border-0", !n.readAt && "bg-primary/5")}>
                          <p className="font-medium leading-snug">{title}</p>
                          {detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{detail}</p>}
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {new Date(n.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Menu utilisateur */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 pl-1.5 pr-2.5" aria-label="Menu utilisateur">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
                    {user?.firstName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ name: "settings" })}>
                  <UserRound className="h-4 w-4" /> Mon profil
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate({ name: "admin" })}>
                    <ShieldCheck className="h-4 w-4" /> Back-office admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await logout();
                    navigate({ name: "landing" }, { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4" /> Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-border/60 py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} MEAH COLLECT — Formulaires collaboratifs à liens dérivés.</p>
          <p className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px]">Conforme RGPD</Badge>
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
