"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, History, Printer, Share2, Trash2 } from "lucide-react";
import { useRequiredSession } from "@/components/AuthProvider";
import { BuyersGuideBadge } from "@/components/BuyersGuideToggle";
import { WalkPrintReport } from "@/components/WalkPrintReport";
import { Button, Card } from "@/components/ui";
import {
  BUYERS_GUIDE_STATUS_LABEL,
  buyersGuideStatus,
  downloadBuyersGuideSummary,
  matchesBuyersGuideFilter,
} from "@/lib/buyersGuide";
import {
  closeAudit,
  deleteScan,
  getActiveLocationId,
  getOpenSession,
  listBuyersGuide,
  listLocations,
  listScans,
  startAudit,
  subscribeStore,
} from "@/lib/store";
import { TERMS } from "@/lib/terms";
import type { BuyersGuideFilter, BuyersGuideRecord, Scan } from "@/lib/types";
import { archiveClosedWalk, printWalkReport, shareWalkText, walkShareText } from "@/lib/walkHistory";
import { formatVin } from "@/lib/vin";

const LOT_FILTERS: Array<{ id: BuyersGuideFilter; label: string }> = [
  { id: "all", label: "All units" },
  { id: "overdue", label: BUYERS_GUIDE_STATUS_LABEL.overdue },
  { id: "missing", label: BUYERS_GUIDE_STATUS_LABEL.missing },
];

export default function LogPage() {
  const session = useRequiredSession();
  const [scans, setScans] = useState<Scan[]>([]);
  const [guides, setGuides] = useState<BuyersGuideRecord[]>([]);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());
  const [locationName, setLocationName] = useState("Lot");
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<BuyersGuideFilter>("all");

  async function load() {
    if (!session.dealership.id) return;
    const locs = await listLocations(session.dealership.id);
    const active = getActiveLocationId(locs);
    const loc = locs.find((l) => l.id === active) ?? locs[0];
    if (!loc) return;
    setLocationName(loc.name);
    const open = (await getOpenSession(session.dealership.id, loc.id)) ?? (await startAudit(session, loc.id));
    setAuditId(open.id);
    setStartedAt(open.startedAt);
    const [walkScans, records] = await Promise.all([
      listScans(session.dealership.id, open.id),
      listBuyersGuide(session.dealership.id),
    ]);
    setScans(walkScans);
    setGuides(records);
  }

  useEffect(() => {
    void load();
    return subscribeStore(() => {
      void load();
    });
  }, [session.dealership.id]);

  const guideByVin = useMemo(() => new Map(guides.map((row) => [row.vin, row])), [guides]);
  const missingCount = scans.filter((scan) => buyersGuideStatus(guideByVin.get(scan.vin) ?? null) === "missing").length;
  const overdueCount = scans.filter((scan) => buyersGuideStatus(guideByVin.get(scan.vin) ?? null) === "overdue").length;
  const visible = scans.filter((scan) =>
    matchesBuyersGuideFilter(buyersGuideStatus(guideByVin.get(scan.vin) ?? null), filter),
  );

  function exportSummary(format: "csv" | "json") {
    downloadBuyersGuideSummary(
      {
        dealershipName: session.dealership.name,
        locationName,
        generatedBy: session.user.fullName,
        generatedAt: new Date().toISOString(),
      },
      scans,
      guides,
      format,
    );
    setNotice(`Buyers Guide audit summary downloaded (${format.toUpperCase()}).`);
  }

  async function endWalk() {
    if (!auditId) return;
    if (!confirm("Close this walk? The Scan List will be saved to Walk History on this device.")) return;
    archiveClosedWalk({
      dealershipId: session.dealership.id,
      dealershipName: session.dealership.name,
      locationName,
      startedAt,
      closedBy: session.user.fullName,
      scans,
    });
    await closeAudit(auditId);
    setNotice(
      scans.length
        ? `Walk archived on this device (${scans.length} VIN${scans.length === 1 ? "" : "s"}).`
        : "Walk closed. Empty walks are not archived.",
    );
    await load();
  }

  function handlePrint() {
    printWalkReport(`VinFuse-Walk-${locationName.replace(/[^a-zA-Z0-9]+/g, "-")}`);
  }

  async function removeScan(scan: Scan) {
    try {
      await deleteScan(session, scan.id);
      setScans((rows) => rows.filter((row) => row.id !== scan.id));
      setNotice(`Removed ${formatVin(scan.vin)}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not remove that VIN.");
    }
  }

  async function handleShare() {
    try {
      const result = await shareWalkText(
        `VinFuse Walk · ${locationName}`,
        walkShareText({
          dealershipName: session.dealership.name,
          locationName,
          closedBy: session.user.fullName,
          startedAt,
          closedAt: new Date().toISOString(),
          vins: scans.map((s) => ({
            vin: s.vin,
            scannedAt: s.scannedAt,
            scannerName: s.scannerName,
            source: s.source,
          })),
        }),
      );
      setNotice(result === "copied" ? "Walk report copied. Paste it into a text or email." : "Walk report shared.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not share.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">
            {TERMS.scanList} / {TERMS.walkReport}
          </p>
          <h1 className="text-3xl font-black">{locationName}</h1>
          <p className="font-semibold text-muted sunlight:text-slate-600">
            {scans.length} VIN{scans.length === 1 ? "" : "s"} captured on this physical walk
          </p>
        </div>
        <Button variant="line" className="min-h-11 px-3 text-xs" onClick={() => void endWalk()}>
          Close walk
        </Button>
      </div>

      <div className="print:hidden flex flex-col gap-3">
        <Card className="p-4">
          <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
            Live {TERMS.scanList} on this device. Closing the walk saves it to Walk History here — it is not discarded
            and is not uploaded to VinFuse.
          </p>
        </Card>

        <Button className="w-full" onClick={handlePrint} disabled={scans.length === 0}>
          <Printer className="h-5 w-5" />
          Print / Export Walk Report
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="line" onClick={() => void handleShare()} disabled={scans.length === 0}>
            <Share2 className="h-5 w-5" />
            Share
          </Button>
          <Link href="/history" className="block">
            <Button variant="line" className="w-full">
              <History className="h-5 w-5" />
              History
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="line" className="text-xs" onClick={() => exportSummary("csv")} disabled={scans.length === 0}>
            <FileDown className="h-5 w-5" />
            Audit CSV
          </Button>
          <Button variant="line" className="text-xs" onClick={() => exportSummary("json")} disabled={scans.length === 0}>
            <FileDown className="h-5 w-5" />
            Audit JSON
          </Button>
        </div>
        {notice ? <p className="text-sm font-bold text-ok">{notice}</p> : null}

        {scans.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Buyers Guide</p>
            <div className="flex flex-col gap-2">
              {LOT_FILTERS.map((chip) => {
                const count = chip.id === "missing" ? missingCount : chip.id === "overdue" ? overdueCount : scans.length;
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
          </div>
        ) : null}

        {scans.length === 0 ? (
          <Card>
            <p className="font-bold">No scans yet. Open Scan and point the camera at a VIN barcode.</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <p className="font-bold">
              No units match {filter === "overdue" ? "Buyers Guide Audit Overdue" : "Missing Guide"} on this lot.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((scan) => {
              const status = buyersGuideStatus(guideByVin.get(scan.vin) ?? null);
              return (
                <li key={scan.id}>
                  <Card className="flex items-start justify-between gap-3 p-4">
                    <Link href={`/log/${scan.vin}`} className="min-w-0 flex-1">
                      <p className="font-mono text-lg font-black tracking-wide text-cyan">{formatVin(scan.vin)}</p>
                      <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
                        {scan.scannerName} · {scan.source === "barcode" ? "Barcode" : "Typed"} ·{" "}
                        {new Date(scan.scannedAt).toLocaleString()}
                      </p>
                      <BuyersGuideBadge status={status} />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${formatVin(scan.vin)}`}
                      title="Remove accidental scan"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-alert/10 hover:text-alert sunlight:text-slate-400"
                      onClick={() => void removeScan(scan)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <WalkPrintReport
        dealershipName={session.dealership.name}
        locationName={locationName}
        closedBy={session.user.fullName}
        startedAt={startedAt}
        closedAt="open"
        vins={scans.map((s) => ({
          vin: s.vin,
          scannedAt: s.scannedAt,
          scannerName: s.scannerName,
          source: s.source,
        }))}
      />
    </div>
  );
}
