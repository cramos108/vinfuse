"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Share2, Trash2 } from "lucide-react";
import { useRequiredSession } from "@/components/AuthProvider";
import { WalkPrintReport } from "@/components/WalkPrintReport";
import { Button, Card } from "@/components/ui";
import {
  deleteArchivedWalk,
  listArchivedWalks,
  printWalkReport,
  shareWalkText,
  walkShareText,
  type ArchivedWalk,
} from "@/lib/walkHistory";
import { formatVin } from "@/lib/vin";

export default function HistoryPage() {
  const session = useRequiredSession();
  const [tick, setTick] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const walks = useMemo(
    () => (session.dealership.id ? listArchivedWalks(session.dealership.id) : []),
    [session.dealership.id, tick],
  );
  const selected = walks.find((w) => w.id === openId) ?? null;

  function refresh() {
    setTick((n) => n + 1);
  }

  async function share(walk: ArchivedWalk) {
    try {
      const result = await shareWalkText(`VinFuse Walk · ${walk.locationName}`, walkShareText(walk));
      setNotice(result === "copied" ? "Copied. Paste into a text or email." : "Shared from this device.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not share.");
    }
  }

  function print(walk: ArchivedWalk) {
    setOpenId(walk.id);
    window.setTimeout(() => {
      printWalkReport(`VinFuse-Walk-${walk.locationName.replace(/[^a-zA-Z0-9]+/g, "-")}`);
    }, 50);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">On this device</p>
        <h1 className="text-3xl font-black">Walk History</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          Closed walks stay in this phone&apos;s local storage. They are not uploaded to VinFuse.
        </p>
      </div>

      <div className="print:hidden flex flex-col gap-3">
        {notice ? <p className="text-sm font-bold text-ok">{notice}</p> : null}
        {walks.length === 0 ? (
          <Card>
            <p className="font-bold">No archived walks yet. Close a walk on the Walk tab to save it here.</p>
            <Link href="/log" className="mt-3 inline-block text-sm font-extrabold text-cyan">
              Back to current walk
            </Link>
          </Card>
        ) : (
          walks.map((walk) => {
            const expanded = openId === walk.id;
            return (
              <Card key={walk.id} className="flex flex-col gap-3 p-4">
                <button type="button" className="text-left" onClick={() => setOpenId(expanded ? null : walk.id)}>
                  <p className="font-black">{walk.locationName}</p>
                  <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
                    {new Date(walk.closedAt).toLocaleString()} · {walk.vins.length} VIN
                    {walk.vins.length === 1 ? "" : "s"} · {walk.closedBy}
                  </p>
                </button>
                {expanded ? (
                  <>
                    <ul className="flex flex-col gap-2">
                      {walk.vins.map((row) => (
                        <li key={`${row.vin}-${row.scannedAt}`} className="font-mono text-sm font-bold text-cyan">
                          {formatVin(row.vin)}
                          <span className="ml-2 font-sans text-xs font-semibold text-muted">
                            {new Date(row.scannedAt).toLocaleTimeString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="text-xs" onClick={() => print(walk)}>
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                      <Button variant="line" className="text-xs" onClick={() => void share(walk)}>
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      className="min-h-11 text-xs text-alert"
                      onClick={() => {
                        if (!confirm("Delete this walk from this device?")) return;
                        deleteArchivedWalk(walk.id);
                        setOpenId(null);
                        refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete from this device
                    </Button>
                  </>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      {selected ? (
        <WalkPrintReport
          dealershipName={selected.dealershipName}
          locationName={selected.locationName}
          closedBy={selected.closedBy}
          startedAt={selected.startedAt}
          closedAt={selected.closedAt}
          vins={selected.vins}
        />
      ) : null}
    </div>
  );
}
