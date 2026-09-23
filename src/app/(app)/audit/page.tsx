"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequiredSession } from "@/components/AuthProvider";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card, Stat } from "@/components/ui";
import { canImportCsv, canReconcile, isManager } from "@/lib/plan";
import { vehicleLabel } from "@/lib/reconcile";
import {
  getActiveLocationId,
  getOpenSession,
  getReconcile,
  listInventory,
  listLocations,
  setActiveLocation,
  startAudit,
} from "@/lib/store";
import type { Location, ReconcileResult, ReconcileRow } from "@/lib/types";
import { formatVin } from "@/lib/vin";

type Tab = "scanned" | "missing" | "unmatched" | "misplaced";

export default function AuditPage() {
  const session = useRequiredSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [report, setReport] = useState<ReconcileResult | null>(null);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [tab, setTab] = useState<Tab>("missing");
  const [error, setError] = useState<string | null>(null);

  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const manager = isManager(session.user.role);

  async function load(id?: string) {
    if (!session.dealership.id) return;
    const locs = await listLocations(session.dealership.id);
    setLocations(locs);
    const active = id ?? getActiveLocationId(locs);
    const loc = locs.find((l) => l.id === active) ?? locs[0];
    if (!loc) return;
    setLocationId(loc.id);
    const inventory = await listInventory(session.dealership.id);
    setInventoryCount(inventory.length);
    if (!canReconcile(session.dealership)) return;
    const open = (await getOpenSession(session.dealership.id, loc.id)) ?? (await startAudit(session, loc.id));
    try {
      setReport(await getReconcile(session, loc, open.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build report.");
    }
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id, session.dealership.plan]);

  if (!manager) {
    return (
      <Card>
        <h1 className="text-2xl font-black">Audit dashboard</h1>
        <p className="mt-2 font-semibold text-muted">Managers run discrepancy reports. Keep scanning — your log is on the Log tab.</p>
      </Card>
    );
  }

  if (!canReconcile(session.dealership)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black">Audit</h1>
        <UpgradeGate
          title="Automated discrepancy reports"
          body="Upgrade to Pro to compare this walk against your DMS CSV and flag missing, unmatched, and misplaced cars."
        />
      </div>
    );
  }

  const rows: ReconcileRow[] =
    tab === "scanned"
      ? report?.scanned ?? []
      : tab === "missing"
        ? report?.missing ?? []
        : tab === "unmatched"
          ? report?.unmatched ?? []
          : report?.misplaced ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro dashboard</p>
          <h1 className="text-3xl font-black">Audit</h1>
        </div>
        {canImportCsv(session.dealership, session.user.role) ? (
          <Link href="/inventory">
            <Button variant="line" className="min-h-11 px-3 text-xs">
              DMS CSV
            </Button>
          </Link>
        ) : null}
      </div>

      {locations.length ? (
        <LocationSwitcher
          dealership={session.dealership}
          locations={locations}
          value={location?.id ?? ""}
          onChange={(id) => {
            setActiveLocation(id);
            void load(id);
          }}
        />
      ) : null}

      {inventoryCount === 0 ? (
        <Card>
          <p className="font-bold">Import a DMS master list to flag missing and misplaced units.</p>
          <Link href="/inventory" className="mt-3 inline-block">
            <Button>Upload CSV</Button>
          </Link>
        </Card>
      ) : null}

      {error ? <p className="font-bold text-alert">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Scanned" value={report?.scanned.length ?? 0} tone="ok" />
        <Stat label="Missing from lot" value={report?.missing.length ?? 0} tone="alert" />
        <Stat label="Unmatched" value={report?.unmatched.length ?? 0} tone="warn" />
        <Stat label="Misplaced" value={report?.misplaced.length ?? 0} tone="cyan" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["scanned", "Scanned"],
            ["missing", "Missing"],
            ["unmatched", "Unmatched"],
            ["misplaced", "Misplaced"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-12 rounded-2xl border-2 px-3 text-sm font-extrabold uppercase tracking-wide ${
              tab === key ? "border-cyan bg-cyan text-cyan-ink" : "border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="font-bold">Nothing in this bucket for the current walk.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.vin}>
              <Card className="p-4">
                <p className="font-mono text-lg font-black tracking-wide text-cyan">{formatVin(row.vin)}</p>
                <p className="font-bold">{vehicleLabel(row)}</p>
                <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
                  {row.stockNumber ? `Stock ${row.stockNumber} · ` : ""}
                  {row.expectedLocationName ? `DMS: ${row.expectedLocationName}` : "Not on master list"}
                  {row.scannedLocationName ? ` · Scanned: ${row.scannedLocationName}` : ""}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
