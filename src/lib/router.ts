"use client";

// ============================================================
// Routeur de vues interne — l'utilisateur ne voit que la route « / ».
// Chaque « page » est encodée dans les query params (ex. ?view=f&slug=…)
// et synchronisée avec history (boutons retour/avant fonctionnels).
//
// IMPORTANT : l'état de vue est un SINGLETON partagé (module-level +
// useSyncExternalStore) pour que navigate() depuis un composant enfant
// (AuthPage, etc.) mette bien à jour la vue rendue par page.tsx.
// ============================================================

import { useCallback, useSyncExternalStore } from "react";
import type { AppView } from "./types";

/** Clé sessionStorage : vue protégée demandée avant la redirection vers la connexion. */
export const INTENDED_VIEW_KEY = "meah-collect:intended-view";

/** Vue protégée mémorisée avant la redirection vers la connexion (si valide). */
export function takeIntendedView(): AppView | null {
  try {
    const raw = sessionStorage.getItem(INTENDED_VIEW_KEY);
    sessionStorage.removeItem(INTENDED_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as AppView;
    if (!v || typeof v !== "object" || typeof v.name !== "string") return null;
    if (["landing", "auth", "invite", "publicForm"].includes(v.name)) return null;
    return v;
  } catch {
    return null;
  }
}

let currentView: AppView =
  typeof window === "undefined" ? { name: "landing" } : parseView(window.location.search);

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setViewInternal(next: AppView) {
  currentView = next;
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    currentView = parseView(window.location.search);
    emit();
  });
}

export function viewToSearch(view: AppView): string {
  const p = new URLSearchParams();
  switch (view.name) {
    case "landing":
      break;
    case "auth":
      p.set("view", "auth");
      p.set("mode", view.mode);
      if (view.token) p.set("token", view.token);
      if (view.inviteToken) p.set("invite", view.inviteToken);
      break;
    case "dashboard":
      p.set("view", "app");
      break;
    case "builder":
      p.set("view", "builder");
      p.set("form", view.formId);
      break;
    case "share":
      p.set("view", "share");
      p.set("form", view.formId);
      break;
    case "team":
      p.set("view", "team");
      p.set("form", view.formId);
      break;
    case "responses":
      p.set("view", "responses");
      p.set("form", view.formId);
      p.set("scope", view.scope);
      break;
    case "settings":
      p.set("view", "settings");
      break;
    case "admin":
      p.set("view", "admin");
      break;
    case "memberSpace":
      p.set("view", "member");
      p.set("form", view.formId);
      break;
    case "invite":
      p.set("view", "invite");
      p.set("token", view.token);
      break;
    case "publicForm":
      p.set("view", "f");
      p.set("slug", view.slug);
      break;
  }
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

export function parseView(search: string): AppView {
  const p = new URLSearchParams(search);
  const view = p.get("view");
  switch (view) {
    case "auth": {
      const mode = p.get("mode") as "login" | "signup" | "verify" | "forgot" | "reset" | null;
      return { name: "auth", mode: mode ?? "login", token: p.get("token") ?? undefined, inviteToken: p.get("invite") ?? undefined };
    }
    case "app":
      return { name: "dashboard" };
    case "builder":
      return p.get("form") ? { name: "builder", formId: p.get("form")! } : { name: "dashboard" };
    case "share":
      return p.get("form") ? { name: "share", formId: p.get("form")! } : { name: "dashboard" };
    case "team":
      return p.get("form") ? { name: "team", formId: p.get("form")! } : { name: "dashboard" };
    case "responses":
      return p.get("form")
        ? { name: "responses", formId: p.get("form")!, scope: p.get("scope") === "all" ? "all" : "mine" }
        : { name: "dashboard" };
    case "settings":
      return { name: "settings" };
    case "admin":
      return { name: "admin" };
    case "member":
      return p.get("form") ? { name: "memberSpace", formId: p.get("form")! } : { name: "dashboard" };
    case "invite":
      return p.get("token") ? { name: "invite", token: p.get("token")! } : { name: "landing" };
    case "f":
      return p.get("slug") ? { name: "publicForm", slug: p.get("slug")! } : { name: "landing" };
    default:
      return { name: "landing" };
  }
}

export function useAppRouter() {
  const view = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentView,
    () => currentView
  );

  const navigate = useCallback((next: AppView, opts?: { replace?: boolean }) => {
    const url = viewToSearch(next);
    if (opts?.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setViewInternal(next);
    window.scrollTo({ top: 0 });
  }, []);

  return { view, navigate };
}

/** URL absolue d'un lien public (à partir de l'origine courante) */
export function publicFormUrl(slug: string): string {
  if (typeof window === "undefined") return `/f/${slug}`;
  return `${window.location.origin}/?view=f&slug=${slug}`;
}

export function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/?view=invite&token=${token}`;
}
