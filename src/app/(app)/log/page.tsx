"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Printer, Share2 } from "lucide-react";
import { useRequiredSession } from "@/components/AuthProvider";
import { WalkPrintReport } from "@/components/WalkPrintReport";
import { Button, Card } from "@/components/ui";
import { closeAudit, getActiveLocationId, getOpenSession, listLocations, listScans, startAudit } from "@/lib/store";
import { TERMS } from "@/lib/terms";
import type { Scan } from "@/lib/types";
import { archiveClosedWalk, printWalkReport, shareWalkText, walkShareText } from "@/lib/walkHistory";
import { formatVin } from "@/lib/vin";

export default function LogPage() {
  const session = useRequiredSession();
  const [scans, setScans] = useState<Scan[]>([]);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());
  const [locationName, setLocationName] = useState("Lot");
  const [notice, setNotice] = useState<string | null>(null);

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
    setScans(await listScans(session.dealership.id, open.id));
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id]);

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
        {notice ? <p className="text-sm font-bold text-ok">{notice}</p> : null}

        {scans.length === 0 ? (
          <Card>
            <p className="font-bold">No scans yet. Open Scan and point the camera at a VIN barcode.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {scans.map((scan) => (
              <li key={scan.id}>
                <Card className="p-4">
                  <p className="font-mono text-lg font-black tracking-wide text-cyan">{formatVin(scan.vin)}</p>
                  <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
                    {scan.scannerName} · {scan.source === "barcode" ? "Barcode" : "Typed"} ·{" "}
                    {new Date(scan.scannedAt).toLocaleString()}
                  </p>
                </Card>
              </li>
            ))}
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
