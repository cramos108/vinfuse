import { vehicleLabel } from "./reconcile";
import { TERMS } from "./terms";
import type { ReconcileResult, ReconcileRow } from "./types";
import { formatVin } from "./vin";

export type AuditPrintMeta = {
  dealershipName: string;
  locationName: string;
  generatedBy: string;
  generatedAt: string;
  baselineUploadedAt: string | null;
};

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function sectionCsv(title: string, rows: ReconcileRow[]): string[] {
  const lines = [`SECTION,${csvCell(title)}`, "VIN,Unit,Stock,DMS location,Walk location,Scanner,Scanned at"];
  if (rows.length === 0) {
    lines.push("(none)");
    return lines;
  }
  for (const row of rows) {
    lines.push(
      [
        formatVin(row.vin),
        vehicleLabel(row),
        row.stockNumber,
        row.expectedLocationName,
        row.scannedLocationName,
        row.scannerName,
        row.scannedAt ? new Date(row.scannedAt).toLocaleString() : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines;
}

export function auditReportFileStem(meta: AuditPrintMeta): string {
  const day = new Date(meta.generatedAt).toISOString().slice(0, 10);
  const lot = meta.locationName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `VinFuse-Walk-Report-${lot || "Lot"}-${day}`;
}

export function buildAuditReportCsv(meta: AuditPrintMeta, report: ReconcileResult): string {
  const header = [
    `${TERMS.walkReport} & Discrepancy Report`,
    `Dealership,${csvCell(meta.dealershipName)}`,
    `Location,${csvCell(meta.locationName)}`,
    `Prepared by,${csvCell(meta.generatedBy)}`,
    `Generated,${csvCell(new Date(meta.generatedAt).toLocaleString())}`,
    `DMS Master Baseline uploaded,${csvCell(meta.baselineUploadedAt ? new Date(meta.baselineUploadedAt).toLocaleString() : "Not uploaded")}`,
    "",
    "COUNTS",
    `On walk (matched),${report.scanned.length}`,
    `Missing from lot,${report.missing.length}`,
    `Unmatched,${report.unmatched.length}`,
    `Misplaced,${report.misplaced.length}`,
    "",
  ];
  return [
    ...header,
    ...sectionCsv(`${TERMS.scanList} / ${TERMS.walkReport}`, report.scanned),
    "",
    ...sectionCsv("Missing from lot", report.missing),
    "",
    ...sectionCsv("Unmatched / not on books", report.unmatched),
    "",
    ...sectionCsv("Misplaced", report.misplaced),
    "",
  ].join("\n");
}

export function downloadTextFile(filename: string, contents: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printAuditReport(title: string) {
  const previous = document.title;
  document.title = title;
  window.print();
  window.setTimeout(() => {
    document.title = previous;
  }, 800);
}
