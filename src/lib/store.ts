"use client";

// ============================================================
// Store global (Zustand) — utilisateur courant + compteurs
// ============================================================

import { create } from "zustand";
import type { SessionUser } from "./types";
import { api } from "./api";

interface AppState {
  user: SessionUser | null;
  booted: boolean;
  unreadNotifications: number;
  setUser: (u: SessionUser | null) => void;
  setUnread: (n: number) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  booted: false,
  unreadNotifications: 0,
  setUser: (u) => set({ user: u, booted: true }),
  setUnread: (n) => set({ unreadNotifications: n }),
  refreshMe: async () => {
    try {
      const me = await api.get<SessionUser>("/api/auth/me");
      set({ user: me, booted: true });
    } catch {
      set({ user: null, booted: true });
    }
  },
  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      set({ user: null, unreadNotifications: 0 });
    }
  },
}));
