import { downloadTextFile } from "./auditReport";
import type {
  BuyersGuideFilter,
  BuyersGuideInterval,
  BuyersGuideRecord,
  BuyersGuideStatus,
  BuyersGuideTerms,
  Scan,
} from "./types";
import { formatVin, normalizeVin } from "./vin";

export const BUYERS_GUIDE_KEY = "vinfuse.buyersGuide.v1";
export const BUYERS_GUIDE_SETTINGS_KEY = "vinfuse.buyersGuide.settings.v1";
export const BUYERS_GUIDE_DEFAULT_INTERVAL: BuyersGuideInterval = 30;

export const BUYERS_GUIDE_TOOLTIP =
  "FTC rules require an accurate Buyers Guide on every displayed vehicle at all times. Use periodic lot walks to verify stickers are present, undamaged, and matching current terms.";

const DAY_MS = 24 * 60 * 60 * 1000;

export const BUYERS_GUIDE_STATUS_LABEL: Record<BuyersGuideStatus, string> = {
  present: "Verified Present",
  recommended: "Inspection Recommended",
};

export const BUYERS_GUIDE_TERMS_LABEL: Record<BuyersGuideTerms, string> = {
  as_is: "As-Is",
  dealer_warranty: "Dealer Warranty",
};

export const BUYERS_GUIDE_INTERVAL_OPTIONS: Array<{ value: BuyersGuideInterval; label: string }> = [
  { value: "walk", label: "Every lot walk" },
  { value: 14, label: "Every 14 days" },
  { value: 30, label: "Every 30 days" },
];

export type BuyersGuideContext = {
  interval: BuyersGuideInterval;
  walkStartedAt?: string | null;
  at?: number;
};

type LegacyRecord = Partial<BuyersGuideRecord> & {
  lastVerifiedAt?: string | null;
  verified?: boolean;
  buyersGuideStatus?: string;
};

type SettingsFile = Record<string, { interval?: BuyersGuideInterval }>;

export function parseBuyersGuideInterval(value: string | number | null | undefined): BuyersGuideInterval {
  if (value === "walk" || value === 14 || value === 30) return value;
  if (value === "14") return 14;
  if (value === "30") return 30;
  return BUYERS_GUIDE_DEFAULT_INTERVAL;
}

export function intervalLabel(interval: BuyersGuideInterval): string {
  return BUYERS_GUIDE_INTERVAL_OPTIONS.find((row) => row.value === interval)?.label ?? "Every 30 days";
}

function loadSettingsFile(): SettingsFile {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BUYERS_GUIDE_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SettingsFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getBuyersGuideInterval(dealershipId: string): BuyersGuideInterval {
  if (!dealershipId) return BUYERS_GUIDE_DEFAULT_INTERVAL;
  return parseBuyersGuideInterval(loadSettingsFile()[dealershipId]?.interval);
}

export function setBuyersGuideIntervalLocal(dealershipId: string, interval: BuyersGuideInterval) {
  const file = loadSettingsFile();
  file[dealershipId] = { interval };
  localStorage.setItem(BUYERS_GUIDE_SETTINGS_KEY, JSON.stringify(file));
}

export function buyersGuideDaysElapsed(verifiedAt: string | null | undefined, at = Date.now()): number | null {
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor(Math.max(0, at - t) / DAY_MS);
}

export function buyersGuideStatusFromAt(
  verifiedAt: string | null | undefined,
  ctx: BuyersGuideContext,
): BuyersGuideStatus {
  const at = ctx.at ?? Date.now();
  if (!verifiedAt) return "recommended";
  const verifiedMs = new Date(verifiedAt).getTime();
  if (!Number.isFinite(verifiedMs)) return "recommended";
  if (ctx.interval === "walk") {
    if (!ctx.walkStartedAt) return "present";
    const walkMs = new Date(ctx.walkStartedAt).getTime();
    if (!Number.isFinite(walkMs)) return "present";
    return verifiedMs >= walkMs ? "present" : "recommended";
  }
  const days = Math.floor(Math.max(0, at - verifiedMs) / DAY_MS);
  return days < ctx.interval ? "present" : "recommended";
}

export function buyersGuideStatus(
  record: BuyersGuideRecord | null | undefined,
  ctx: BuyersGuideContext,
): BuyersGuideStatus {
  return buyersGuideStatusFromAt(record?.buyersGuideVerifiedAt, ctx);
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
  termsChangeRequired: boolean;
  terms: BuyersGuideTerms | null;
};

export function buyersGuideCycle(
  record: BuyersGuideRecord | null | undefined,
  ctx: BuyersGuideContext,
): BuyersGuideCycle {
  const buyersGuideVerifiedAt = record?.buyersGuideVerifiedAt ?? null;
  const status = buyersGuideStatusFromAt(buyersGuideVerifiedAt, ctx);
  return {
    status,
    label: BUYERS_GUIDE_STATUS_LABEL[status],
    buyersGuideVerifiedAt,
    daysElapsed: buyersGuideDaysElapsed(buyersGuideVerifiedAt, ctx.at),
    termsChangeRequired: Boolean(record?.termsChangeRequired),
    terms: record?.terms ?? null,
  };
}

export function matchesBuyersGuideFilter(
  record: BuyersGuideRecord | null | undefined,
  filter: BuyersGuideFilter,
  ctx: BuyersGuideContext,
): boolean {
  if (filter === "all") return true;
  if (filter === "terms") return Boolean(record?.termsChangeRequired);
  return buyersGuideStatus(record, ctx) === filter;
}

export function makeBuyersGuideRecord(input: {
  vin: string;
  dealershipId: string;
  buyersGuideVerifiedAt: string | null;
  verifiedBy: string | null;
  verifierName: string | null;
  updatedAt: string;
  terms?: BuyersGuideTerms | null;
  termsChangeRequired?: boolean;
  termsChangedAt?: string | null;
  ctx?: BuyersGuideContext;
}): BuyersGuideRecord {
  const vin = normalizeVin(input.vin);
  const buyersGuideVerifiedAt = input.buyersGuideVerifiedAt;
  const ctx = input.ctx ?? { interval: BUYERS_GUIDE_DEFAULT_INTERVAL };
  return {
    vin,
    dealershipId: input.dealershipId,
    buyersGuideVerifiedAt,
    buyersGuideStatus: buyersGuideStatusFromAt(buyersGuideVerifiedAt, ctx),
    verifiedBy: input.verifiedBy,
    verifierName: input.verifierName,
    terms: input.terms ?? null,
    termsChangeRequired: Boolean(input.termsChangeRequired),
    termsChangedAt: input.termsChangedAt ?? null,
    updatedAt: input.updatedAt,
  };
}

export function coerceBuyersGuideRecord(raw: LegacyRecord, ctx?: BuyersGuideContext): BuyersGuideRecord | null {
  const vin = normalizeVin(raw.vin ?? "");
  const dealershipId = raw.dealershipId ?? "";
  if (!vin || !dealershipId) return null;
  const stamped =
    raw.buyersGuideVerifiedAt ??
    (raw.verified === false ? null : (raw.lastVerifiedAt ?? null));
  const terms = raw.terms === "as_is" || raw.terms === "dealer_warranty" ? raw.terms : null;
  return makeBuyersGuideRecord({
    vin,
    dealershipId,
    buyersGuideVerifiedAt: stamped,
    verifiedBy: raw.verifiedBy ?? null,
    verifierName: raw.verifierName ?? null,
    updatedAt: raw.updatedAt ?? stamped ?? new Date().toISOString(),
    terms,
    termsChangeRequired: Boolean(raw.termsChangeRequired),
    termsChangedAt: raw.termsChangedAt ?? null,
    ctx,
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

export function upsertBuyersGuideLocalMany(records: BuyersGuideRecord[]): BuyersGuideRecord[] {
  const incoming = new Map(records.map((row) => [`${row.dealershipId}:${normalizeVin(row.vin)}`, row]));
  const rows = loadAllLocal().filter((row) => !incoming.has(`${row.dealershipId}:${row.vin}`));
  const next = [...incoming.values()];
  saveAllLocal([...rows, ...next]);
  return next;
}

export function mergeBuyersGuideRecords(
  timestampSource: BuyersGuideRecord,
  termsSource: BuyersGuideRecord | null | undefined,
): BuyersGuideRecord {
  if (!termsSource) return timestampSource;
  return {
    ...timestampSource,
    terms: termsSource.terms ?? timestampSource.terms,
    termsChangeRequired: termsSource.termsChangeRequired,
    termsChangedAt: termsSource.termsChangedAt ?? timestampSource.termsChangedAt,
  };
}

export type BuyersGuideCounts = {
  total: number;
  present: number;
  recommended: number;
  terms: number;
};

export function buyersGuideCounts(
  vins: string[],
  records: BuyersGuideRecord[],
  ctx: BuyersGuideContext,
): BuyersGuideCounts {
  const byVin = new Map(records.map((row) => [row.vin, row]));
  const seen = new Set<string>();
  const counts: BuyersGuideCounts = { total: 0, present: 0, recommended: 0, terms: 0 };
  for (const vin of vins) {
    if (seen.has(vin)) continue;
    seen.add(vin);
    const record = byVin.get(vin) ?? null;
    counts.total += 1;
    counts[buyersGuideStatus(record, ctx)] += 1;
    if (record?.termsChangeRequired) counts.terms += 1;
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
  termsChangeRequired: boolean;
  terms: BuyersGuideTerms | null;
};

export type BuyersGuideExportMeta = {
  dealershipName: string;
  locationName: string;
  generatedBy: string;
  generatedAt: string;
  interval: BuyersGuideInterval;
  walkStartedAt?: string | null;
};

export function buildBuyersGuideExportRows(
  scans: Scan[],
  records: BuyersGuideRecord[],
  ctx: BuyersGuideContext,
): BuyersGuideExportRow[] {
  const byVin = new Map(records.map((row) => [row.vin, row]));
  const seen = new Set<string>();
  const rows: BuyersGuideExportRow[] = [];
  for (const scan of scans) {
    if (seen.has(scan.vin)) continue;
    seen.add(scan.vin);
    const record = byVin.get(scan.vin) ?? null;
    const cycle = buyersGuideCycle(record, ctx);
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
      termsChangeRequired: cycle.termsChangeRequired,
      terms: cycle.terms,
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
    "VinFuse Walk Report · Lot Inspection & Accuracy Audit",
    `Dealership,${csvCell(meta.dealershipName)}`,
    `Location,${csvCell(meta.locationName)}`,
    `Prepared by,${csvCell(meta.generatedBy)}`,
    `Generated,${csvCell(new Date(meta.generatedAt).toLocaleString())}`,
    `Inspection interval,${csvCell(intervalLabel(meta.interval))}`,
    csvCell(BUYERS_GUIDE_TOOLTIP),
    `Vehicles,${rows.length}`,
    `Verified Present,${rows.filter((r) => r.status === "present").length}`,
    `Inspection Recommended,${rows.filter((r) => r.status === "recommended").length}`,
    `Terms reprint required,${rows.filter((r) => r.termsChangeRequired).length}`,
    "",
    [
      "VIN",
      "Scanned at",
      "Scanner",
      "Buyers Guide status",
      "buyersGuideVerifiedAt (ISO)",
      "Buyers Guide verified at",
      "Days since last check",
      "Verified by",
      "Terms reprint required",
      "Posted terms",
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
      row.termsChangeRequired ? "Yes" : "No",
      row.terms ? BUYERS_GUIDE_TERMS_LABEL[row.terms] : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [...header, ...body, ""].join("\n");
}

export function buildBuyersGuideJson(meta: BuyersGuideExportMeta, rows: BuyersGuideExportRow[]): string {
  return `${JSON.stringify(
    {
      title: "VinFuse Walk Report · Lot Inspection & Accuracy Audit",
      dealership: meta.dealershipName,
      location: meta.locationName,
      generatedBy: meta.generatedBy,
      generatedAt: meta.generatedAt,
      inspectionInterval: intervalLabel(meta.interval),
      note: BUYERS_GUIDE_TOOLTIP,
      counts: {
        vehicles: rows.length,
        present: rows.filter((r) => r.status === "present").length,
        recommended: rows.filter((r) => r.status === "recommended").length,
        termsReprint: rows.filter((r) => r.termsChangeRequired).length,
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
        termsChangeRequired: row.termsChangeRequired,
        terms: row.terms,
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
  const rows = buildBuyersGuideExportRows(scans, records, {
    interval: meta.interval,
    walkStartedAt: meta.walkStartedAt,
  });
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
  ctx: BuyersGuideContext,
): Scan {
  const cycle = buyersGuideCycle(record, ctx);
  return {
    ...scan,
    buyersGuideVerifiedAt: cycle.buyersGuideVerifiedAt,
    buyersGuideStatus: cycle.status,
    termsChangeRequired: cycle.termsChangeRequired,
  };
}
