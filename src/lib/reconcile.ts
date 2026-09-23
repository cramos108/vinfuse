import type { InventoryItem, ReconcileResult, ReconcileRow, Scan } from "./types";

function blankRow(partial: Partial<ReconcileRow> & { vin: string }): ReconcileRow {
  return {
    stockNumber: "",
    year: "",
    make: "",
    model: "",
    color: "",
    expectedLocationName: "",
    scannedLocationName: "",
    scannedAt: null,
    scannerName: "",
    ...partial,
  };
}

export function reconcileInventory(
  scans: Scan[],
  inventory: InventoryItem[],
  activeLocationId: string,
  activeLocationName: string,
): ReconcileResult {
  const latestByVin = new Map<string, Scan>();
  for (const scan of scans) {
    const prev = latestByVin.get(scan.vin);
    if (!prev || prev.scannedAt < scan.scannedAt) latestByVin.set(scan.vin, scan);
  }

  const invByVin = new Map(inventory.map((item) => [item.vin, item]));
  const scanned: ReconcileRow[] = [];
  const unmatched: ReconcileRow[] = [];
  const misplaced: ReconcileRow[] = [];

  for (const [vin, scan] of latestByVin) {
    const item = invByVin.get(vin);
    if (!item) {
      unmatched.push(
        blankRow({
          vin,
          scannedLocationName: scan.locationName,
          scannedAt: scan.scannedAt,
          scannerName: scan.scannerName,
        }),
      );
      continue;
    }
    const expectedId = item.expectedLocationId;
    const wrongLot = Boolean(expectedId && expectedId !== scan.locationId);
    const row = blankRow({
      vin,
      stockNumber: item.stockNumber,
      year: item.year,
      make: item.make,
      model: item.model,
      color: item.color,
      expectedLocationName: item.expectedLocationName,
      scannedLocationName: scan.locationName,
      scannedAt: scan.scannedAt,
      scannerName: scan.scannerName,
    });
    if (wrongLot) misplaced.push(row);
    else scanned.push(row);
  }

  const missing: ReconcileRow[] = [];
  for (const item of inventory) {
    const belongsHere =
      !item.expectedLocationId || item.expectedLocationId === activeLocationId;
    if (!belongsHere) continue;
    if (latestByVin.has(item.vin)) continue;
    missing.push(
      blankRow({
        vin: item.vin,
        stockNumber: item.stockNumber,
        year: item.year,
        make: item.make,
        model: item.model,
        color: item.color,
        expectedLocationName: item.expectedLocationName || activeLocationName,
      }),
    );
  }

  return { scanned, missing, unmatched, misplaced };
}

export function vehicleLabel(row: Pick<ReconcileRow, "year" | "make" | "model" | "color">): string {
  const parts = [row.year, row.make, row.model, row.color].filter(Boolean);
  return parts.join(" ") || "Unknown unit";
}
