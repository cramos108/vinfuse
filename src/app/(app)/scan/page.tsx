"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { LocationSwitcher } from "@/components/LocationSwitcher";
import { VinScanner } from "@/components/VinScanner";
import { Card } from "@/components/ui";
import {
  getActiveLocationId,
  getOpenSession,
  listLocations,
  listScans,
  logScan,
  setActiveLocation,
  startAudit,
} from "@/lib/store";
import type { AuditSession, Location, Scan } from "@/lib/types";
import { formatVin } from "@/lib/vin";

export default function ScanPage() {
  const session = useRequiredSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [audit, setAudit] = useState<AuditSession | null>(null);
  const [last, setLast] = useState<Scan | null>(null);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState<"ok" | "dup" | "err" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const location = locations.find((l) => l.id === locationId) ?? locations[0];

  const boot = useCallback(async () => {
    if (!session.dealership.id) return;
    const locs = await listLocations(session.dealership.id);
    setLocations(locs);
    const active = getActiveLocationId(locs);
    if (active) {
      setLocationId(active);
      const open = await startAudit(session, active);
      setAudit(open);
      const scans = await listScans(session.dealership.id, open.id);
      setCount(scans.length);
    }
  }, [session]);

  useEffect(() => {
    void boot();
  }, [boot]);

  async function changeLocation(id: string) {
    setActiveLocation(id);
    setLocationId(id);
    setLast(null);
    const open = await startAudit(session, id);
    setAudit(open);
    const scans = await listScans(session.dealership.id, open.id);
    setCount(scans.length);
  }

  const onVin = useCallback(
    async (vin: string, source: "barcode" | "manual") => {
      if (!location || !audit || busy) return;
      setBusy(true);
      try {
        const result = await logScan(session, location, audit, vin, source);
        if (!result.ok) {
          setFlash("err");
          setMessage(result.error);
          return;
        }
        setLast(result.scan);
        if (result.duplicate) {
          setFlash("dup");
          setMessage("Already on this audit.");
        } else {
          setFlash("ok");
          setMessage("Logged to this lot.");
          setCount((n) => n + 1);
        }
      } finally {
        setBusy(false);
      }
    },
    [audit, busy, location, session],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Lot walk</p>
        <h1 className="text-3xl font-black">Scan VIN</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          {session.user.fullName} · {session.dealership.name}
        </p>
      </div>

      {locations.length ? (
        <LocationSwitcher
          dealership={session.dealership}
          locations={locations}
          value={location?.id ?? ""}
          onChange={(id) => void changeLocation(id)}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">This session</p>
          <p className="text-4xl font-black text-cyan">{count}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Status</p>
          <p className="text-lg font-black">{audit ? "Live" : "Starting…"}</p>
        </Card>
      </div>

      <VinScanner onVin={onVin} busy={busy} />

      {last ? (
        <Card
          className={
            flash === "ok"
              ? "border-ok bg-ok/10"
              : flash === "dup"
                ? "border-warn bg-warn/10"
                : flash === "err"
                  ? "border-alert bg-alert/10"
                  : ""
          }
        >
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{message}</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-wider text-cyan">{formatVin(last.vin)}</p>
          <p className="text-sm font-bold">
            {last.locationName} · {new Date(last.scannedAt).toLocaleTimeString()}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
