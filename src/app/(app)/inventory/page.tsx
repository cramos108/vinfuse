"use client";

import { useEffect, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { TermGlossary } from "@/components/TermGlossary";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card } from "@/components/ui";
import { canImportCsv } from "@/lib/plan";
import { importInventoryCsv, listInventory, listLocations } from "@/lib/store";
import { TERMS } from "@/lib/terms";
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
        <h1 className="text-3xl font-black">{TERMS.dmsMasterList}</h1>
        <UpgradeGate
          title={`${TERMS.dmsMasterBaseline} is Pro`}
          body="Free includes unlimited scanning and a Scan List. Upload a DMS Master Baseline on Pro to compare this walk against what the books say should be on the lot."
        />
        <TermGlossary />
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
      setMessage(
        `Baseline set: ${result.count} units on the ${TERMS.dmsMasterList}${
          result.skipped ? ` · skipped ${result.skipped} rows` : ""
        }. Scan Lists and past Walk Reports were not changed.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Baseline upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const uploadedAt = items.reduce<string | null>(
    (latest, item) => (!latest || item.importedAt > latest ? item.importedAt : latest),
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro · current audit</p>
        <h1 className="text-3xl font-black">{TERMS.dmsMasterBaseline}</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          Upload the book inventory this walk should be compared against. This sets the{" "}
          <span className="text-white sunlight:text-ink">{TERMS.dmsMasterList}</span> for the current audit. It does
          not replace, delete, or overwrite Scan Lists or historical Walk Reports.
        </p>
      </div>

      <TermGlossary />

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-bold">
          CSV headers: VIN, Stock, Year, Make, Model, Color, Location. Location names should match your lots.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          aria-label={`Upload ${TERMS.dmsMasterBaseline} CSV`}
          className="block w-full text-sm font-bold file:mr-3 file:rounded-xl file:border-2 file:border-cyan file:bg-cyan file:px-4 file:py-3 file:font-extrabold file:uppercase file:text-cyan-ink"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        <a href="/sample-dms.csv" className="text-sm font-extrabold text-cyan" download>
          Download sample {TERMS.dmsMasterList} CSV
        </a>
        {uploadedAt ? (
          <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
            Current baseline uploaded {new Date(uploadedAt).toLocaleString()}. A new file only updates the comparison
            list for this audit.
          </p>
        ) : (
          <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
            No baseline yet. Upload before running a discrepancy report.
          </p>
        )}
      </Card>
      {message ? <p className="font-bold text-ok">{message}</p> : null}
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <p className="text-sm font-bold text-muted">
        {items.length} unit{items.length === 1 ? "" : "s"} on the {TERMS.dmsMasterList}
      </p>
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
                Should be at: {item.expectedLocationName || "No lot on file"} {item.color ? `· ${item.color}` : ""}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <Button variant="line" disabled>
          Waiting for a {TERMS.dmsMasterBaseline}
        </Button>
      ) : null}
    </div>
  );
}
