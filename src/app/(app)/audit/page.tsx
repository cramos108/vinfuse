"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, Printer } from "lucide-react";
import { useRequiredSession } from "@/components/AuthProvider";
import { AuditPrintReport } from "@/components/AuditPrintReport";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { TermGlossary } from "@/components/TermGlossary";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card, Stat } from "@/components/ui";
import {
  auditReportFileStem,
  buildAuditReportCsv,
  downloadTextFile,
  printAuditReport,
  type AuditPrintMeta,
} from "@/lib/auditReport";
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
import { TERMS } from "@/lib/terms";
import type { Location, ReconcileResult, ReconcileRow } from "@/lib/types";
import { formatVin } from "@/lib/vin";

type Tab = "scanned" | "missing" | "unmatched" | "misplaced";

export default function AuditPage() {
  const session = useRequiredSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [report, setReport] = useState<ReconcileResult | null>(null);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [baselineUploadedAt, setBaselineUploadedAt] = useState<string | null>(null);
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
    setBaselineUploadedAt(
      inventory.reduce<string | null>(
        (latest, item) => (!latest || item.importedAt > latest ? item.importedAt : latest),
        null,
      ),
    );
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

  const printMeta: AuditPrintMeta = useMemo(
    () => ({
      dealershipName: session.dealership.name,
      locationName: location?.name ?? "Lot",
      generatedBy: session.user.fullName,
      generatedAt: new Date().toISOString(),
      baselineUploadedAt,
    }),
    [baselineUploadedAt, location?.name, session.dealership.name, session.user.fullName],
  );

  if (!manager) {
    return (
      <Card>
        <h1 className="text-2xl font-black">{TERMS.walkReport}</h1>
        <p className="mt-2 font-semibold text-muted">
          Managers run the discrepancy report. Your camera captures stay on the {TERMS.scanList} tab.
        </p>
      </Card>
    );
  }

  if (!canReconcile(session.dealership)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black">{TERMS.walkReport}</h1>
        <UpgradeGate
          title="Automated discrepancy reports"
          body={`Upgrade to Pro to compare this ${TERMS.scanList} against the ${TERMS.dmsMasterList} and flag missing, unmatched, and misplaced cars.`}
        />
        <TermGlossary />
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

  function handlePrint() {
    if (!report) return;
    printAuditReport(auditReportFileStem(printMeta));
  }

  function handleExport() {
    if (!report) return;
    downloadTextFile(`${auditReportFileStem(printMeta)}.csv`, buildAuditReportCsv(printMeta, report));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro dashboard</p>
            <h1 className="text-3xl font-black">{TERMS.walkReport}</h1>
            <p className="font-semibold text-muted sunlight:text-slate-600">
              Compare the {TERMS.scanList} from this walk to the {TERMS.dmsMasterList}.
            </p>
          </div>
          {canImportCsv(session.dealership, session.user.role) ? (
            <Link href="/inventory">
              <Button variant="line" className="min-h-11 px-3 text-xs">
                Baseline
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="print:hidden flex flex-col gap-4">
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

        <TermGlossary />

        {inventoryCount === 0 ? (
          <Card>
            <p className="font-bold">
              Upload a {TERMS.dmsMasterBaseline} so this walk can be checked against what the books say should be here.
              Scan history stays intact.
            </p>
            <Link href="/inventory" className="mt-3 inline-block">
              <Button>Upload {TERMS.dmsMasterBaseline}</Button>
            </Link>
          </Card>
        ) : null}

        {error ? <p className="font-bold text-alert">{error}</p> : null}

        <Button className="w-full" onClick={handlePrint} disabled={!report}>
          <Printer className="h-5 w-5" />
          Print discrepancy report
        </Button>
        <Button variant="line" className="w-full text-xs" onClick={handleExport} disabled={!report}>
          <FileDown className="h-5 w-5" />
          Export CSV
        </Button>
        <p className="text-xs font-semibold text-muted sunlight:text-slate-600">
          Print the Scan List from the Walk tab (available on Free). This page prints the Pro discrepancy buckets.
          Choose Save as PDF in the browser dialog.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="On walk (matched)" value={report?.scanned.length ?? 0} tone="ok" />
          <Stat label="Missing from lot" value={report?.missing.length ?? 0} tone="alert" />
          <Stat label="Unmatched" value={report?.unmatched.length ?? 0} tone="warn" />
          <Stat label="Misplaced" value={report?.misplaced.length ?? 0} tone="cyan" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["scanned", TERMS.scanList],
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
            <p className="font-bold">Nothing in this bucket for the current {TERMS.walkReport}.</p>
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
                    {row.expectedLocationName ? `${TERMS.dmsMasterList}: ${row.expectedLocationName}` : `Not on ${TERMS.dmsMasterList}`}
                    {row.scannedLocationName ? ` · ${TERMS.scanList}: ${row.scannedLocationName}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report ? <AuditPrintReport meta={printMeta} report={report} /> : null}
    </div>
  );
}
