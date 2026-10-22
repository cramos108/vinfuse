import { downloadTextFile } from "./auditReport";
import type { BuyersGuideFilter, BuyersGuideRecord, BuyersGuideStatus, Scan } from "./types";
import { formatVin, normalizeVin } from "./vin";

/** Green ("valid"): 0–29 days since buyersGuideVerifiedAt. */
export const BUYERS_GUIDE_VALID_MAX_DAYS = 29;
/** Amber ("warning"): 30–45 days. Re-check on the next lot walk. */
export const BUYERS_GUIDE_WARNING_MAX_DAYS = 45;
export const BUYERS_GUIDE_KEY = "vinfuse.buyersGuide.v1";

const DAY_MS = 24 * 60 * 60 * 1000;

export const BUYERS_GUIDE_STATUS_LABEL: Record<BuyersGuideStatus, string> = {
  valid: "Compliant",
  warning: "Re-check Due",
  expired: "Non-Compliant / Missing",
};

export const BUYERS_GUIDE_STATUS_TONE: Record<BuyersGuideStatus, "ok" | "warn" | "alert"> = {
  valid: "ok",
  warning: "warn",
  expired: "alert",
};

type LegacyRecord = Partial<BuyersGuideRecord> & {
  lastVerifiedAt?: string | null;
  verified?: boolean;
};

export function buyersGuideDaysElapsed(verifiedAt: string | null | undefined, at = Date.now()): number | null {
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor(Math.max(0, at - t) / DAY_MS);
}

export function buyersGuideStatusFromAt(
  verifiedAt: string | null | undefined,
  at = Date.now(),
): BuyersGuideStatus {
  const days = buyersGuideDaysElapsed(verifiedAt, at);
  if (days === null) return "expired";
  if (days <= BUYERS_GUIDE_VALID_MAX_DAYS) return "valid";
  if (days <= BUYERS_GUIDE_WARNING_MAX_DAYS) return "warning";
  return "expired";
}

export function buyersGuideStatus(
  record: BuyersGuideRecord | null | undefined,
  at = Date.now(),
): BuyersGuideStatus {
  return buyersGuideStatusFromAt(record?.buyersGuideVerifiedAt, at);
}

export function buyersGuideWarningAt(verifiedAt: string | null | undefined): string | null {
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + (BUYERS_GUIDE_VALID_MAX_DAYS + 1) * DAY_MS).toISOString();
}

export function buyersGuideExpiredAt(verifiedAt: string | null | undefined): string | null {
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + (BUYERS_GUIDE_WARNING_MAX_DAYS + 1) * DAY_MS).toISOString();
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
  buyersGuideVerifiedAt: string | null;
  daysElapsed: number | null;
  warningAt: string | null;
  expiredAt: string | null;
};

export function buyersGuideCycle(record: BuyersGuideRecord | null | undefined, at = Date.now()): BuyersGuideCycle {
  const buyersGuideVerifiedAt = record?.buyersGuideVerifiedAt ?? null;
  const status = buyersGuideStatusFromAt(buyersGuideVerifiedAt, at);
  return {
    status,
    label: BUYERS_GUIDE_STATUS_LABEL[status],
    buyersGuideVerifiedAt,
    daysElapsed: buyersGuideDaysElapsed(buyersGuideVerifiedAt, at),
    warningAt: buyersGuideWarningAt(buyersGuideVerifiedAt),
    expiredAt: buyersGuideExpiredAt(buyersGuideVerifiedAt),
  };
}

export function matchesBuyersGuideFilter(status: BuyersGuideStatus, filter: BuyersGuideFilter): boolean {
  if (filter === "all") return true;
  return status === filter;
}

export function makeBuyersGuideRecord(input: {
  vin: string;
  dealershipId: string;
  buyersGuideVerifiedAt: string | null;
  verifiedBy: string | null;
  verifierName: string | null;
  updatedAt: string;
  at?: number;
}): BuyersGuideRecord {
  const vin = normalizeVin(input.vin);
  const buyersGuideVerifiedAt = input.buyersGuideVerifiedAt;
  return {
    vin,
    dealershipId: input.dealershipId,
    buyersGuideVerifiedAt,
    buyersGuideStatus: buyersGuideStatusFromAt(buyersGuideVerifiedAt, input.at),
    verifiedBy: input.verifiedBy,
    verifierName: input.verifierName,
    updatedAt: input.updatedAt,
  };
}

export function coerceBuyersGuideRecord(raw: LegacyRecord, at = Date.now()): BuyersGuideRecord | null {
  const vin = normalizeVin(raw.vin ?? "");
  const dealershipId = raw.dealershipId ?? "";
  if (!vin || !dealershipId) return null;
  const stamped =
    raw.buyersGuideVerifiedAt ??
    (raw.verified === false ? null : (raw.lastVerifiedAt ?? null));
  return makeBuyersGuideRecord({
    vin,
    dealershipId,
    buyersGuideVerifiedAt: stamped,
    verifiedBy: raw.verifiedBy ?? null,
    verifierName: raw.verifierName ?? null,
    updatedAt: raw.updatedAt ?? stamped ?? new Date(at).toISOString(),
    at,
  });
}

function loadAllLocal(): BuyersGuideRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BUYERS_GUIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => coerceBuyersGuideRecord(row))
      .filter((row): row is BuyersGuideRecord => row !== null);
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
  return upsertBuyersGuideLocalMany([record])[0];
}

export function upsertBuyersGuideLocalMany(records: BuyersGuideRecord[]): BuyersGuideRecord[] {
  const incoming = new Map(records.map((row) => [`${row.dealershipId}:${normalizeVin(row.vin)}`, row]));
  const rows = loadAllLocal().filter((row) => !incoming.has(`${row.dealershipId}:${row.vin}`));
  const next = [...incoming.values()];
  saveAllLocal([...rows, ...next]);
  return next;
}

export type BuyersGuideCounts = {
  total: number;
  valid: number;
  warning: number;
  expired: number;
};

export function buyersGuideCounts(
  vins: string[],
  records: BuyersGuideRecord[],
  at = Date.now(),
): BuyersGuideCounts {
  const byVin = new Map(records.map((row) => [row.vin, row]));
  const seen = new Set<string>();
  const counts: BuyersGuideCounts = { total: 0, valid: 0, warning: 0, expired: 0 };
  for (const vin of vins) {
    if (seen.has(vin)) continue;
    seen.add(vin);
    counts.total += 1;
    counts[buyersGuideStatus(byVin.get(vin) ?? null, at)] += 1;
  }
  return counts;
}

export type BuyersGuideExportRow = {
  vin: string;
  status: BuyersGuideStatus;
  statusLabel: string;
  buyersGuideVerifiedAt: string | null;
  buyersGuideVerifiedAtLocal: string;
  daysElapsed: number | null;
  verifiedBy: string;
  scannedAt: string | null;
  scannerName: string;
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
      buyersGuideVerifiedAt: cycle.buyersGuideVerifiedAt,
      buyersGuideVerifiedAtLocal: formatBuyersGuideWhen(cycle.buyersGuideVerifiedAt),
      daysElapsed: cycle.daysElapsed,
      verifiedBy: record?.verifierName ?? "",
      scannedAt: scan.scannedAt,
      scannerName: scan.scannerName,
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
  return `VinFuse-Walk-Report-${lot || "Lot"}-${day}`;
}

export function buildWalkReportCsv(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  const header = [
    "VinFuse Walk Report · FTC Buyers Guide",
    `Dealership,${csvCell(meta.dealershipName)}`,
    `Location,${csvCell(meta.locationName)}`,
    `Prepared by,${csvCell(meta.generatedBy)}`,
    `Generated,${csvCell(new Date(meta.generatedAt).toLocaleString())}`,
    "Status window,valid 0-29 days; warning 30-45 days; expired 46+ days or unverified",
    `Vehicles,${rows.length}`,
    `Compliant (Green),${rows.filter((r) => r.status === "valid").length}`,
    `Re-check Due (Amber),${rows.filter((r) => r.status === "warning").length}`,
    `Non-Compliant / Missing (Red),${rows.filter((r) => r.status === "expired").length}`,
    "",
    [
      "VIN",
      "Scanned at",
      "Scanner",
      "Buyers Guide status",
      "buyersGuideVerifiedAt (ISO)",
      "Buyers Guide verified at",
      "Days elapsed",
      "Verified by",
    ].join(","),
  ];
  const body = rows.map((row) =>
    [
      formatVin(row.vin),
      row.scannedAt ? new Date(row.scannedAt).toLocaleString() : "",
      row.scannerName,
      row.statusLabel,
      row.buyersGuideVerifiedAt ?? "",
      row.buyersGuideVerifiedAt ? row.buyersGuideVerifiedAtLocal : "",
      row.daysElapsed === null ? "" : String(row.daysElapsed),
      row.verifiedBy,
    ]
      .map(csvCell)
      .join(","),
  );
  return [...header, ...body, ""].join("\n");
}

export function buildBuyersGuideCsv(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  return buildWalkReportCsv(meta, rows);
}

export function buildBuyersGuideJson(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  return `${JSON.stringify(
    {
      title: "VinFuse Walk Report · FTC Buyers Guide",
      dealership: meta.dealershipName,
      location: meta.locationName,
      generatedBy: meta.generatedBy,
      generatedAt: meta.generatedAt,
      windows: {
        valid: "0-29 days",
        warning: "30-45 days",
        expired: "46+ days or unverified",
      },
      counts: {
        vehicles: rows.length,
        valid: rows.filter((r) => r.status === "valid").length,
        warning: rows.filter((r) => r.status === "warning").length,
        expired: rows.filter((r) => r.status === "expired").length,
      },
      vehicles: rows.map((row) => ({
        vin: row.vin,
        buyersGuideStatus: row.status,
        statusLabel: row.statusLabel,
        buyersGuideVerifiedAt: row.buyersGuideVerifiedAt,
        daysElapsed: row.daysElapsed,
        verifiedBy: row.verifiedBy || null,
        scannedAt: row.scannedAt,
        scannerName: row.scannerName,
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
  downloadTextFile(`${stem}.csv`, buildWalkReportCsv(meta, rows));
}

export function attachBuyersGuideToScan(
  scan: Scan,
  record: BuyersGuideRecord | null,
  at = Date.now(),
): Scan {
  const cycle = buyersGuideCycle(record, at);
  return {
    ...scan,
    buyersGuideVerifiedAt: cycle.buyersGuideVerifiedAt,
    buyersGuideStatus: cycle.status,
  };
}
