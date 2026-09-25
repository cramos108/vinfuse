import { APP_NAME } from "@/lib/brand";
import type { ArchivedVin } from "@/lib/walkHistory";
import { formatVin } from "@/lib/vin";

export function WalkPrintReport({
  dealershipName,
  locationName,
  closedBy,
  startedAt,
  closedAt,
  vins,
}: {
  dealershipName: string;
  locationName: string;
  closedBy: string;
  startedAt?: string;
  closedAt: string;
  vins: ArchivedVin[];
}) {
  return (
    <div className="hidden bg-white p-6 text-ink print:block">
      <header className="border-b-2 border-ink pb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600">
          {APP_NAME} · Walk Report
        </p>
        <h1 className="mt-1 text-3xl font-black">{locationName}</h1>
        <p className="mt-1 text-sm font-semibold">{dealershipName}</p>
        <p className="text-xs text-slate-600">
          {startedAt ? `Started ${new Date(startedAt).toLocaleString()} · ` : ""}
          {closedAt === "open" ? "In progress" : `Closed ${new Date(closedAt).toLocaleString()}`} · {closedBy}
        </p>
        <p className="text-xs text-slate-600">{vins.length} VIN{vins.length === 1 ? "" : "s"} on this Scan List</p>
      </header>
      {vins.length === 0 ? (
        <p className="mt-6 text-sm font-semibold">No VINs on this walk.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-1.5 pr-2 font-extrabold">#</th>
              <th className="py-1.5 pr-2 font-extrabold">VIN</th>
              <th className="py-1.5 pr-2 font-extrabold">Time</th>
              <th className="py-1.5 font-extrabold">Scanner</th>
            </tr>
          </thead>
          <tbody>
            {vins.map((row, i) => (
              <tr key={`${row.vin}-${row.scannedAt}`} className="border-b border-slate-200">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2 font-mono font-bold">{formatVin(row.vin)}</td>
                <td className="py-1.5 pr-2">{new Date(row.scannedAt).toLocaleString()}</td>
                <td className="py-1.5">
                  {row.scannerName}
                  {row.source === "barcode" ? " · barcode" : row.source === "manual" ? " · typed" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <footer className="mt-8 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
        Archived on this device. Lot audit data is not uploaded to VinFuse servers.
      </footer>
    </div>
  );
}
