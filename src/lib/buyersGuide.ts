import { downloadTextFile } from "./auditReport";
import type { BuyersGuideFilter, BuyersGuideRecord, BuyersGuideStatus, Scan } from "./types";
import { formatVin, normalizeVin } from "./vin";

export const BUYERS_GUIDE_CYCLE_DAYS = 30;
export const BUYERS_GUIDE_CYCLE_MS = BUYERS_GUIDE_CYCLE_DAYS * 24 * 60 * 60 * 1000;
export const BUYERS_GUIDE_KEY = "vinfuse.buyersGuide.v1";

export const BUYERS_GUIDE_STATUS_LABEL: Record<BuyersGuideStatus, string> = {
  missing: "Missing Guide",
  overdue: "Buyers Guide Audit Overdue",
  verified: "Buyers Guide Verified",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buyersGuideStatus(
  record: BuyersGuideRecord | null | undefined,
  at = Date.now(),
): BuyersGuideStatus {
  if (!record?.verified || !record.lastVerifiedAt) return "missing";
  const verifiedAt = new Date(record.lastVerifiedAt).getTime();
  if (!Number.isFinite(verifiedAt)) return "missing";
  if (at - verifiedAt >= BUYERS_GUIDE_CYCLE_MS) return "overdue";
  return "verified";
}

export function buyersGuideExpiresAt(lastVerifiedAt: string | null | undefined): string | null {
  if (!lastVerifiedAt) return null;
  const t = new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + BUYERS_GUIDE_CYCLE_MS).toISOString();
}

export function buyersGuideDaysRemaining(lastVerifiedAt: string | null | undefined, at = Date.now()): number | null {
  const expires = buyersGuideExpiresAt(lastVerifiedAt);
  if (!expires) return null;
  return Math.ceil((new Date(expires).getTime() - at) / DAY_MS);
}

export function formatBuyersGuideWhen(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return "Never";
  return t.toLocaleString();
}

export type BuyersGuideCycle = {
  status: BuyersGuideStatus;
  label: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
};

export function buyersGuideCycle(record: BuyersGuideRecord | null | undefined, at = Date.now()): BuyersGuideCycle {
  const lastVerifiedAt = record?.lastVerifiedAt ?? null;
  const status = buyersGuideStatus(record, at);
  return {
    status,
    label: BUYERS_GUIDE_STATUS_LABEL[status],
    lastVerifiedAt,
    expiresAt: buyersGuideExpiresAt(lastVerifiedAt),
    daysRemaining: buyersGuideDaysRemaining(lastVerifiedAt, at),
  };
}

export function matchesBuyersGuideFilter(
  status: BuyersGuideStatus,
  filter: BuyersGuideFilter,
): boolean {
  if (filter === "all") return true;
  return status === filter;
}

function loadAllLocal(): BuyersGuideRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BUYERS_GUIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BuyersGuideRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllLocal(rows: BuyersGuideRecord[]) {
  localStorage.setItem(BUYERS_GUIDE_KEY, JSON.stringify(rows));
}

export function listBuyersGuideLocal(dealershipId: string): BuyersGuideRecord[] {
  return loadAllLocal().filter((row) => row.dealershipId === dealershipId);
}

export function getBuyersGuideLocal(dealershipId: string, vin: string): BuyersGuideRecord | null {
  const key = normalizeVin(vin);
  return listBuyersGuideLocal(dealershipId).find((row) => row.vin === key) ?? null;
}

export function upsertBuyersGuideLocal(record: BuyersGuideRecord): BuyersGuideRecord {
  const vin = normalizeVin(record.vin);
  const next: BuyersGuideRecord = { ...record, vin };
  const rows = loadAllLocal().filter(
    (row) => !(row.dealershipId === next.dealershipId && row.vin === vin),
  );
  rows.push(next);
  saveAllLocal(rows);
  return next;
}

export type BuyersGuideExportRow = {
  vin: string;
  status: BuyersGuideStatus;
  statusLabel: string;
  lastVerifiedAt: string | null;
  lastVerifiedAtLocal: string;
  verifiedBy: string;
  expiresAt: string | null;
  expiresAtLocal: string;
  daysRemaining: number | null;
  currentlyPosted: boolean;
};

export type BuyersGuideExportMeta = {
  dealershipName: string;
  locationName: string;
  generatedBy: string;
  generatedAt: string;
};

export function buildBuyersGuideExportRows(
  scans: Scan[],
  records: BuyersGuideRecord[],
  at = Date.now(),
): BuyersGuideExportRow[] {
  const byVin = new Map(records.map((row) => [row.vin, row]));
  const seen = new Set<string>();
  const rows: BuyersGuideExportRow[] = [];
  for (const scan of scans) {
    if (seen.has(scan.vin)) continue;
    seen.add(scan.vin);
    const record = byVin.get(scan.vin) ?? null;
    const cycle = buyersGuideCycle(record, at);
    rows.push({
      vin: scan.vin,
      status: cycle.status,
      statusLabel: cycle.label,
      lastVerifiedAt: cycle.lastVerifiedAt,
      lastVerifiedAtLocal: formatBuyersGuideWhen(cycle.lastVerifiedAt),
      verifiedBy: record?.verifierName ?? "",
      expiresAt: cycle.expiresAt,
      expiresAtLocal: formatBuyersGuideWhen(cycle.expiresAt),
      daysRemaining: cycle.daysRemaining,
      currentlyPosted: Boolean(record?.verified),
    });
  }
  return rows.sort((a, b) => a.vin.localeCompare(b.vin));
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buyersGuideExportStem(meta: BuyersGuideExportMeta): string {
  const day = new Date(meta.generatedAt).toISOString().slice(0, 10);
  const lot = meta.locationName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `VinFuse-Buyers-Guide-Audit-${lot || "Lot"}-${day}`;
}

export function buildBuyersGuideCsv(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  const header = [
    "FTC Buyers Guide Audit Summary",
    `Dealership,${csvCell(meta.dealershipName)}`,
    `Location,${csvCell(meta.locationName)}`,
    `Prepared by,${csvCell(meta.generatedBy)}`,
    `Generated,${csvCell(new Date(meta.generatedAt).toLocaleString())}`,
    `Verification cycle (days),${BUYERS_GUIDE_CYCLE_DAYS}`,
    `Vehicles,${rows.length}`,
    `Missing Guide,${rows.filter((r) => r.status === "missing").length}`,
    `Buyers Guide Audit Overdue,${rows.filter((r) => r.status === "overdue").length}`,
    `Buyers Guide Verified,${rows.filter((r) => r.status === "verified").length}`,
    "",
    [
      "VIN",
      "Status",
      "Last verified (ISO)",
      "Last verified",
      "Verified by",
      "Expires (ISO)",
      "Expires",
      "Days remaining",
      "Window sticker posted",
    ].join(","),
  ];
  const body = rows.map((row) =>
    [
      formatVin(row.vin),
      row.statusLabel,
      row.lastVerifiedAt ?? "",
      row.lastVerifiedAt ? row.lastVerifiedAtLocal : "",
      row.verifiedBy,
      row.expiresAt ?? "",
      row.expiresAt ? row.expiresAtLocal : "",
      row.daysRemaining === null ? "" : String(row.daysRemaining),
      row.currentlyPosted ? "Yes" : "No",
    ]
      .map(csvCell)
      .join(","),
  );
  return [...header, ...body, ""].join("\n");
}

export function buildBuyersGuideJson(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  return `${JSON.stringify(
    {
      title: "FTC Buyers Guide Audit Summary",
      dealership: meta.dealershipName,
      location: meta.locationName,
      generatedBy: meta.generatedBy,
      generatedAt: meta.generatedAt,
      cycleDays: BUYERS_GUIDE_CYCLE_DAYS,
      counts: {
        vehicles: rows.length,
        missing: rows.filter((r) => r.status === "missing").length,
        overdue: rows.filter((r) => r.status === "overdue").length,
        verified: rows.filter((r) => r.status === "verified").length,
      },
      vehicles: rows.map((row) => ({
        vin: row.vin,
        status: row.status,
        statusLabel: row.statusLabel,
        lastVerifiedAt: row.lastVerifiedAt,
        verifiedBy: row.verifiedBy || null,
        expiresAt: row.expiresAt,
        daysRemaining: row.daysRemaining,
        windowStickerPosted: row.currentlyPosted,
      })),
    },
    null,
    2,
  )}\n`;
}

export function downloadBuyersGuideSummary(
  meta: BuyersGuideExportMeta,
  scans: Scan[],
  records: BuyersGuideRecord[],
  format: "csv" | "json",
) {
  const rows = buildBuyersGuideExportRows(scans, records);
  const stem = buyersGuideExportStem(meta);
  if (format === "json") {
    downloadTextFile(`${stem}.json`, buildBuyersGuideJson(meta, rows), "application/json;charset=utf-8");
    return;
  }
  downloadTextFile(`${stem}.csv`, buildBuyersGuideCsv(meta, rows));
}