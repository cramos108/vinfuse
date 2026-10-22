"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { BuyersGuideBadge, BuyersGuideVerifyButton } from "@/components/BuyersGuideToggle";
import { TermGlossary } from "@/components/TermGlossary";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card, Stat } from "@/components/ui";
import {
  BUYERS_GUIDE_STATUS_LABEL,
  buyersGuideCounts,
  buyersGuideStatus,
  matchesBuyersGuideFilter,
} from "@/lib/buyersGuide";
import { canImportCsv, isManager } from "@/lib/plan";
import {
  importInventoryCsv,
  listBuyersGuide,
  listInventory,
  listLocations,
  subscribeStore,
  verifyBuyersGuideBatch,
  verifyBuyersGuidePresent,
} from "@/lib/store";
import { TERMS } from "@/lib/terms";
import type { BuyersGuideFilter, BuyersGuideRecord, InventoryItem, Location } from "@/lib/types";
import { formatVin } from "@/lib/vin";

const AUDIT_FILTERS: Array<{ id: BuyersGuideFilter; label: string }> = [
  { id: "all", label: "Buyers Guide Audit" },
  { id: "valid", label: BUYERS_GUIDE_STATUS_LABEL.valid },
  { id: "warning", label: BUYERS_GUIDE_STATUS_LABEL.warning },
  { id: "expired", label: BUYERS_GUIDE_STATUS_LABEL.expired },
];

export default function InventoryPage() {
  const session = useRequiredSession();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [guides, setGuides] = useState<BuyersGuideRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<BuyersGuideFilter>("all");
  const [verifyVin, setVerifyVin] = useState<string | null>(null);

  async function load() {
    if (!session.dealership.id) return;
    setLocations(await listLocations(session.dealership.id));
    const [inventory, records] = await Promise.all([
      listInventory(session.dealership.id),
      listBuyersGuide(session.dealership.id),
    ]);
    setItems(inventory);
    setGuides(records);
  }

  useEffect(() => {
    void load();
    return subscribeStore(() => {
      void load();
    });
  }, [session.dealership.id]);

  const guideByVin = useMemo(() => new Map(guides.map((row) => [row.vin, row])), [guides]);
  const counts = useMemo(
    () => buyersGuideCounts(items.map((item) => item.vin), guides),
    [items, guides],
  );
  const visible = items.filter((item) =>
    matchesBuyersGuideFilter(buyersGuideStatus(guideByVin.get(item.vin) ?? null), filter),
  );

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

  async function verifyOne(vin: string) {
    setVerifyVin(vin);
    setError(null);
    try {
      await verifyBuyersGuidePresent(session, vin);
      setMessage(`Buyers Guide verified on ${formatVin(vin)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify Buyers Guide.");
    } finally {
      setVerifyVin(null);
    }
  }

  async function verifyLot() {
    const vins = visible.map((item) => item.vin);
    if (!vins.length) return;
    if (
      !confirm(
        `Stamp Buyers Guide verified now on ${vins.length} unit${vins.length === 1 ? "" : "s"}? Confirm the physical window stickers are posted.`,
      )
    ) {
      return;
    }
    setVerifyVin("*");
    setError(null);
    try {
      await verifyBuyersGuideBatch(session, vins);
      setMessage(`Buyers Guide verified on ${vins.length} unit${vins.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not batch-verify Buyers Guide.");
    } finally {
      setVerifyVin(null);
    }
  }

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

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Buyers Guide Audit</p>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total Lot Units" value={counts.total} />
            <Stat label="Compliant" value={counts.valid} tone="ok" />
            <Stat label="Re-check Due" value={counts.warning} tone="warn" />
            <Stat label="Non-Compliant" value={counts.expired} tone="alert" />
          </div>
          <div className="flex flex-col gap-2">
            {AUDIT_FILTERS.map((chip) => {
              const count =
                chip.id === "valid"
                  ? counts.valid
                  : chip.id === "warning"
                    ? counts.warning
                    : chip.id === "expired"
                      ? counts.expired
                      : counts.total;
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`flex min-h-12 items-center justify-between rounded-2xl border-2 px-4 text-left text-sm font-extrabold ${
                    active ? "border-cyan bg-cyan text-cyan-ink" : "border-line sunlight:border-slate-300"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
          {isManager(session.user.role) ? (
            <Button variant="ok" disabled={verifyVin !== null || visible.length === 0} onClick={() => void verifyLot()}>
              Verify all window stickers
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm font-bold text-muted">
        {items.length} unit{items.length === 1 ? "" : "s"} on the {TERMS.dmsMasterList}
      </p>
      <ul className="flex flex-col gap-2">
        {visible.map((item) => {
          const status = buyersGuideStatus(guideByVin.get(item.vin) ?? null);
          return (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 p-4">
                <div>
                  <p className="font-mono text-base font-black text-cyan">{formatVin(item.vin)}</p>
                  <p className="font-bold">
                    {[item.year, item.make, item.model].filter(Boolean).join(" ") || "Unit"}
                    {item.stockNumber ? ` · ${item.stockNumber}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-muted">
                    Should be at: {item.expectedLocationName || "No lot on file"} {item.color ? `· ${item.color}` : ""}
                  </p>
                  <BuyersGuideBadge status={status} />
                </div>
                <BuyersGuideVerifyButton
                  busy={verifyVin === item.vin || verifyVin === "*"}
                  compact
                  onVerify={() => void verifyOne(item.vin)}
                />
              </Card>
            </li>
          );
        })}
      </ul>
      {items.length === 0 ? (
        <Button variant="line" disabled>
          Waiting for a {TERMS.dmsMasterBaseline}
        </Button>
      ) : visible.length === 0 ? (
        <Card>
          <p className="font-bold">No units match this Buyers Guide filter.</p>
        </Card>
      ) : null}
    </div>
  );
}
