"use client";

import { useEffect, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { Button, Card } from "@/components/ui";
import { closeAudit, getActiveLocationId, getOpenSession, listLocations, listScans, startAudit } from "@/lib/store";
import { TERMS } from "@/lib/terms";
import type { Scan } from "@/lib/types";
import { formatVin } from "@/lib/vin";

export default function LogPage() {
  const session = useRequiredSession();
  const [scans, setScans] = useState<Scan[]>([]);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("Lot");

  async function load() {
    if (!session.dealership.id) return;
    const locs = await listLocations(session.dealership.id);
    const active = getActiveLocationId(locs);
    const loc = locs.find((l) => l.id === active) ?? locs[0];
    if (!loc) return;
    setLocationName(loc.name);
    const open = (await getOpenSession(session.dealership.id, loc.id)) ?? (await startAudit(session, loc.id));
    setAuditId(open.id);
    setScans(await listScans(session.dealership.id, open.id));
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id]);

  async function endWalk() {
    if (!auditId) return;
    if (!confirm("Close this Walk Report? You can start a new Scan List anytime. Past walks stay in history.")) return;
    await closeAudit(auditId);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
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
      <Card className="p-4">
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          This is the live {TERMS.scanList}: units porters actually scanned. It is separate from the{" "}
          {TERMS.dmsMasterList} (what the books say should be here). Uploading a new baseline does not clear this list.
        </p>
      </Card>
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
                  {scan.scannerName} ·{" "}
                  {scan.source === "barcode" ? "Barcode" : scan.source === "ocr" ? "OCR text" : "Typed"} ·{" "}
                  {new Date(scan.scannedAt).toLocaleString()}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
