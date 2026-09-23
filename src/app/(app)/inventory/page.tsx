"use client";

import { useEffect, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card } from "@/components/ui";
import { canImportCsv } from "@/lib/plan";
import { importInventoryCsv, listInventory, listLocations } from "@/lib/store";
import type { InventoryItem, Location } from "@/lib/types";
import { formatVin } from "@/lib/vin";

export default function InventoryPage() {
  const session = useRequiredSession();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!session.dealership.id) return;
    setLocations(await listLocations(session.dealership.id));
    setItems(await listInventory(session.dealership.id));
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id]);

  if (!canImportCsv(session.dealership, session.user.role)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black">DMS inventory</h1>
        <UpgradeGate
          title="CSV master list is Pro"
          body="Free includes unlimited scanning and a raw log. Import your DMS file on Pro to auto-flag missing and misplaced cars."
        />
      </div>
    );
  }

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const result = await importInventoryCsv(session, locations, text);
      setMessage(`Imported ${result.count} units${result.skipped ? ` · skipped ${result.skipped} rows` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro</p>
        <h1 className="text-3xl font-black">DMS CSV</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          Upload replaces the current master list. Headers: VIN, Stock, Year, Make, Model, Color, Location.
        </p>
      </div>
      <Card>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="block w-full text-sm font-bold file:mr-3 file:rounded-xl file:border-2 file:border-cyan file:bg-cyan file:px-4 file:py-3 file:font-extrabold file:uppercase file:text-cyan-ink"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        <a href="/sample-dms.csv" className="mt-3 inline-block text-sm font-extrabold text-cyan" download>
          Download sample CSV
        </a>
      </Card>
      {message ? <p className="font-bold text-ok">{message}</p> : null}
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <p className="text-sm font-bold text-muted">{items.length} units on the master list</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card className="p-4">
              <p className="font-mono text-base font-black text-cyan">{formatVin(item.vin)}</p>
              <p className="font-bold">
                {[item.year, item.make, item.model].filter(Boolean).join(" ") || "Unit"}
                {item.stockNumber ? ` · ${item.stockNumber}` : ""}
              </p>
              <p className="text-sm font-semibold text-muted">
                {item.expectedLocationName || "No lot on file"} {item.color ? `· ${item.color}` : ""}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <Button variant="line" disabled>Waiting for a CSV</Button> : null}
    </div>
  );
}
