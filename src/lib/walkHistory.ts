"use client";

import type { Scan, ScanSource } from "./types";
import { formatVin } from "./vin";

const KEY = "vinfuse.walkHistory.v1";
const MAX_WALKS = 80;

export type ArchivedVin = {
  vin: string;
  scannedAt: string;
  scannerName: string;
  source: ScanSource;
};

export type ArchivedWalk = {
  id: string;
  dealershipId: string;
  dealershipName: string;
  locationName: string;
  startedAt: string;
  closedAt: string;
  closedBy: string;
  vins: ArchivedVin[];
};

function loadAll(): ArchivedWalk[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedWalk[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(walks: ArchivedWalk[]) {
  localStorage.setItem(KEY, JSON.stringify(walks.slice(0, MAX_WALKS)));
}

export function listArchivedWalks(dealershipId: string): ArchivedWalk[] {
  return loadAll()
    .filter((w) => w.dealershipId === dealershipId)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

export function getArchivedWalk(id: string): ArchivedWalk | null {
  return loadAll().find((w) => w.id === id) ?? null;
}

export function archiveClosedWalk(input: {
  dealershipId: string;
  dealershipName: string;
  locationName: string;
  startedAt: string;
  closedBy: string;
  scans: Scan[];
}): ArchivedWalk | null {
  if (input.scans.length === 0) return null;
  const walk: ArchivedWalk = {
    id: crypto.randomUUID(),
    dealershipId: input.dealershipId,
    dealershipName: input.dealershipName,
    locationName: input.locationName,
    startedAt: input.startedAt,
    closedAt: new Date().toISOString(),
    closedBy: input.closedBy,
    vins: input.scans.map((s) => ({
      vin: s.vin,
      scannedAt: s.scannedAt,
      scannerName: s.scannerName,
      source: s.source,
    })),
  };
  const next = [walk, ...loadAll().filter((w) => w.id !== walk.id)];
  saveAll(next);
  return walk;
}

export function deleteArchivedWalk(id: string) {
  saveAll(loadAll().filter((w) => w.id !== id));
}

export function walkShareText(walk: {
  dealershipName: string;
  locationName: string;
  closedBy: string;
  startedAt?: string;
  closedAt: string;
  vins: ArchivedVin[];
}): string {
  const lines = [
    `VinFuse Walk Report`,
    `${walk.dealershipName} · ${walk.locationName}`,
    `Closed ${new Date(walk.closedAt).toLocaleString()} by ${walk.closedBy}`,
    `${walk.vins.length} VIN${walk.vins.length === 1 ? "" : "s"}`,
    "",
    ...walk.vins.map(
      (v, i) =>
        `${i + 1}. ${formatVin(v.vin)}  ${new Date(v.scannedAt).toLocaleString()}  ${v.scannerName}`,
    ),
    "",
    "Stored on this device. Not uploaded to VinFuse.",
  ];
  return lines.join("\n");
}

export async function shareWalkText(title: string, text: string): Promise<"shared" | "copied"> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return "shared";
    }
  }
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("Sharing is not available on this device.");
}

export function printWalkReport(title: string) {
  const previous = document.title;
  document.title = title;
  window.print();
  window.setTimeout(() => {
    document.title = previous;
  }, 800);
}
