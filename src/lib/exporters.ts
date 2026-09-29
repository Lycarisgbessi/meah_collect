// ============================================================
// Générateurs d'exports — Section 10 du cahier des charges
// Excel : feuille « Réponses » + « Résumé », en-têtes stylés, filtres auto, en-tête figé.
// PDF   : page de garde, tableau paginé, orientation auto, pied numéroté.
// CSV   : échappement + anti-injection formule (§9.3).
// ============================================================

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { csvSafe } from "./api-utils";
import type { FormFieldDef } from "./types";

export interface ExportPayload {
  formTitle: string;
  fields: FormFieldDef[]; // questions à exporter (blocs de contenu exclus)
  rows: Record<string, string>[]; // valeurs formatées par clé de champ
  meta: { collectedBy: boolean; collectedByName?: string; scope: string; filters: Record<string, string | undefined>; generatedBy: string; totalRows: number };
}

const SYSTEM_HEADERS_COLLECT = ["Date", "Heure", "Collecté par"];

/** Neutralise les formules de tableur (Excel/LibreOffice) dans toute cellule texte. */
function cellSafe(v: string): string {
  return csvSafe(String(v ?? ""));
}

function systemCells(row: Record<string, string>, includeCollector: boolean): string[] {
  const cells = [row.__date ?? "", row.__time ?? ""];
  if (includeCollector) cells.push(row.__collector ?? "");
  return cells;
}

function metaLines(p: ExportPayload): string[] {
  const lines: string[] = [];
  lines.push(`Formulaire : ${p.formTitle}`);
  lines.push(`Exporté par : ${p.meta.generatedBy}`);
  lines.push(`Périmètre : ${p.meta.scope}`);
  const f = p.meta.filters;
  if (f.from || f.to) lines.push(`Période : ${f.from ?? "…"} → ${f.to ?? "…"}`);
  if (f.member_id && p.meta.collectedByName) lines.push(`Membre : ${p.meta.collectedByName}`);
  if (f.status) lines.push(`Statut : ${f.status}`);
  if (f.q) lines.push(`Recherche : « ${f.q} »`);
  lines.push(`Total : ${p.meta.totalRows} réponse(s)`);
  return lines;
}

// ---------------- Excel (.xlsx) ----------------
export async function buildXlsx(p: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MEAH COLLECT";
  const ws = wb.addWorksheet("Réponses");

  const headers = [...p.fields.map((f) => f.label), ...SYSTEM_HEADERS_COLLECT.filter((_, i) => i < 2 || p.meta.collectedBy)];
  ws.addRow(headers);

  // Mise en forme en-tête (10.1) : or champagne, gras, blanc
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB08D57" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 24;

  for (const row of p.rows) {
    // Anti-injection de formule (§9.3) : préfixe appliqué à TOUTE cellule commençant par = + - @
    ws.addRow([...p.fields.map((f) => cellSafe(row[f.key] ?? "")), ...systemCells(row, p.meta.collectedBy).map(cellSafe)]);
  }

  // Largeurs adaptées + filtres automatiques + en-tête figé
  ws.columns.forEach((col, i) => {
    const label = headers[i] ?? "";
    let max = Math.min(label.length + 4, 42);
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      max = Math.max(max, Math.min(String(cell.value ?? "").length + 2, 42));
    });
    col.width = Math.max(12, max);
  });
  if (p.rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.eachRow((row, n) => {
    if (n > 1) {
      row.alignment = { vertical: "top", wrapText: false };
      if (n % 2 === 1) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F3EA" } };
      }
    }
  });

  // Feuille « Résumé » (10.1)
  const rs = wb.addWorksheet("Résumé");
  rs.columns = [{ width: 32 }, { width: 60 }];
  rs.addRow(["Résumé de l'export"]).font = { bold: true, size: 14 };
  rs.addRow([]);
  for (const line of metaLines(p)) {
    const [k, ...rest] = line.split(" : ");
    rs.addRow([k, rest.join(" : ")]);
  }
  rs.addRow([]);
  rs.addRow(["Colonnes"]).font = { bold: true };
  p.fields.forEach((f, i) => rs.addRow([`${i + 1}.`, f.label + (f.isRequired ? " (obligatoire)" : "")]));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ---------------- PDF ----------------
export function buildPdf(p: ExportPayload): Buffer {
  const manyCols = p.fields.length > 6;
  const doc = new jsPDF({ orientation: manyCols ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Page de garde optionnelle → ici en-tête compact élégant (10.2)
  doc.setFillColor(176, 141, 87);
  doc.rect(0, 0, pageWidth, 86, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(p.formTitle.slice(0, 70), 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Export du ${new Date().toLocaleString("fr-FR")} — ${p.meta.generatedBy}`, 40, 60);
  doc.text(metaLines(p).slice(2, 5).join("  ·  ").slice(0, 140), 40, 74);

  const startY = 110;
  const headers = [...p.fields.map((f) => f.label), ...(p.meta.collectedBy ? ["Collecté par"] : []), "Date"];
  const body = p.rows.map((row) => [
    ...p.fields.map((f) => cellSafe((row[f.key] ?? "").slice(0, 120))),
    ...(p.meta.collectedBy ? [cellSafe(row.__collector ?? "")] : []),
    cellSafe(row.__date ?? ""),
  ]);

  autoTable(doc, {
    head: [headers],
    body,
    startY,
    margin: { left: 30, right: 30, bottom: 46 },
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak", textColor: [33, 29, 23] },
    headStyles: { fillColor: [176, 141, 87], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 243, 234] },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 113, 100);
      doc.text(`Généré le ${new Date().toLocaleString("fr-FR")} — MEAH COLLECT`, 30, h - 18);
      const page = doc.getNumberOfPages();
      doc.text(`${page}`, pageWidth - 40, h - 18);
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------- CSV ----------------
export function buildCsv(p: ExportPayload): Buffer {
  const headers = [...p.fields.map((f) => f.label), ...SYSTEM_HEADERS_COLLECT.filter((_, i) => i < 2 || p.meta.collectedBy)];
  const esc = (v: string) => `"${csvSafe(String(v ?? "")).replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(";")];
  for (const row of p.rows) {
    lines.push([...p.fields.map((f) => row[f.key] ?? ""), ...systemCells(row, p.meta.collectedBy)].map(esc).join(";"));
  }
  // BOM UTF-8 pour Excel (Annexe N : accents corrects)
  return Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8");
}
