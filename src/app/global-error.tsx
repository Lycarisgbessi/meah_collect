"use client";

// ============================================================
// Error boundary racine (html/body) — dernier filet avant l'écran blanc.
// ============================================================

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("[app] Erreur critique :", error);
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f3", color: "#100e0b" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>MEAH COLLECT — erreur critique</h1>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 440 }}>
            L&apos;application a rencontré un problème et ne peut pas s&apos;afficher. Réessayez ; si le problème persiste, contactez le support.
          </p>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #B08D57", background: "#B08D57", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
