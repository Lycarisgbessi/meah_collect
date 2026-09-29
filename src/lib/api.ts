"use client";

// ============================================================
// Client API typé — gère les erreurs métier Annexe D.3
// ============================================================

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  status: number;
  constructor(code: string, message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("NETWORK", "Connexion perdue. Vos saisies sont conservées, nous réessayons.", 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* pas de corps */
  }
  const b = body as { data?: T; error?: { code: string; message: string; fields?: Record<string, string> } } | null;
  if (!res.ok) {
    const err = b?.error;
    throw new ApiError(err?.code ?? "UNKNOWN", err?.message ?? "Une erreur est survenue. Réessayez.", res.status, err?.fields);
  }
  // Convention serveur : le corps de succès EST la donnée (jsonOk ne l'enveloppe pas).
  return b as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body?: unknown) => request<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};
