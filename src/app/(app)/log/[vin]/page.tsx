"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useRequiredSession } from "@/components/AuthProvider";
import { BuyersGuideToggle } from "@/components/BuyersGuideToggle";
import { Button, Card } from "@/components/ui";
import { BUYERS_GUIDE_CYCLE_DAYS, buyersGuideCycle } from "@/lib/buyersGuide";
import {
  getActiveLocationId,
  getBuyersGuide,
  getOpenSession,
  listInventory,
  listLocations,
  listScans,
  setBuyersGuideVerified,
  startAudit,
} from "@/lib/store";
import type { BuyersGuideRecord, InventoryItem, Scan } from "@/lib/types";
import { formatVin, isValidVin, normalizeVin } from "@/lib/vin";

export default function ScannedVehiclePage() {
  const session = useRequiredSession();
  const params = useParams();
  const vin = normalizeVin(String(params.vin ?? ""));
  const [scan, setScan] = useState<Scan | null>(null);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [record, setRecord] = useState<BuyersGuideRecord | null>(null);
  const [locationName, setLocationName] = useState("Lot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.dealership.id || !isValidVin(vin)) return;
    const locs = await listLocations(session.dealership.id);
    const active = getActiveLocationId(locs);
    const loc = locs.find((l) => l.id === active) ?? locs[0];
    if (loc) setLocationName(loc.name);
    const open = loc
      ? ((await getOpenSession(session.dealership.id, loc.id)) ?? (await startAudit(session, loc.id)))
      : null;
    const [walkScans, inventory, guide] = await Promise.all([
      open ? listScans(session.dealership.id, open.id) : Promise.resolve([] as Scan[]),
      listInventory(session.dealership.id),
      getBuyersGuide(session.dealership.id, vin),
    ]);
    setScan(walkScans.find((row) => row.vin === vin) ?? null);
    setItem(inventory.find((row) => row.vin === vin) ?? null);
    setRecord(guide);
  }, [session, vin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleVerified(verified: boolean) {
    setBusy(true);
    setError(null);
    try {
      setRecord(await setBuyersGuideVerified(session, vin, verified));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Buyers Guide verification.");
    } finally {
      setBusy(false);
    }
  }

  if (!isValidVin(vin)) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/log" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-cyan">
          <ChevronLeft className="h-5 w-5" />
          Walk
        </Link>
        <Card>
          <p className="font-bold">That VIN is not valid.</p>
        </Card>
      </div>
    );
  }

  const unit = [item?.year, item?.make, item?.model].filter(Boolean).join(" ") || "Scanned unit";
  const cycle = buyersGuideCycle(record);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/log" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-cyan">
        <ChevronLeft className="h-5 w-5" />
        Walk
      </Link>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Scanned vehicle</p>
        <h1 className="font-mono text-2xl font-black tracking-wide text-cyan">{formatVin(vin)}</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          {unit}
          {item?.stockNumber ? ` · Stock ${item.stockNumber}` : ""}
        </p>
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          {scan
            ? `${scan.scannerName} · ${scan.source === "barcode" ? "Barcode" : scan.source === "ocr" ? "OCR" : "Typed"} · ${new Date(scan.scannedAt).toLocaleString()}`
            : "Not on the current Walk Scan List."}
        </p>
        <p className="text-sm font-bold">{scan?.locationName ?? locationName}</p>
        {item?.color ? <p className="text-sm font-semibold text-muted">{item.color}</p> : null}
      </Card>

      <Card>
        <BuyersGuideToggle record={record} busy={busy} onChange={(next) => void toggleVerified(next)} />
        {error ? <p className="mt-3 font-bold text-alert">{error}</p> : null}
      </Card>

      <Card className="p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">30-day cycle</p>
        <p className="mt-1 text-sm font-semibold text-muted sunlight:text-slate-600">
          FTC window sticker verifications expire {BUYERS_GUIDE_CYCLE_DAYS} days after the last recorded check.
          This unit is currently <span className="text-white sunlight:text-ink">{cycle.label}</span>.
        </p>
      </Card>

      <Link href="/log" className="block">
        <Button variant="line" className="w-full">
          Back to lot list
        </Button>
      </Link>
    </div>
  );
}
