// ============================================================
// BrandLogo — monogramme « M » de MEAH COLLECT (identique au favicon).
// Carré noir profond #161310, bordure + « M » en dégradé or champagne.
// Police : Playfair Display (chargée globalement) avec repli Georgia.
// Décoratif (aria-hidden) : le nom de la marque est toujours adjacent.
// ============================================================

"use client";

import { useId } from "react";

export function BrandLogo({ size = 36, className }: { size?: number; className?: string }) {
  // id unique par instance pour éviter les collisions de dégradés SVG
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 30 30"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C9A76F" />
          <stop offset="0.5" stopColor="#B08D57" />
          <stop offset="1" stopColor="#96754A" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="28.5" height="28.5" rx="7.5" fill="#161310" />
      <rect
        x="0.75"
        y="0.75"
        width="28.5"
        height="28.5"
        rx="7.5"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.1"
      />
      <text
        x="15"
        y="20.6"
        textAnchor="middle"
        fontFamily="var(--font-playfair), Georgia, 'Times New Roman', serif"
        fontSize="15.5"
        fontWeight="600"
        fill={`url(#${gradId})`}
      >
        M
      </text>
    </svg>
  );
}
