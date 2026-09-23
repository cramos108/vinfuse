import type { AuditPrintMeta } from "@/lib/auditReport";
import { APP_NAME } from "@/lib/brand";
import { vehicleLabel } from "@/lib/reconcile";
import { TERMS } from "@/lib/terms";
import type { ReconcileResult, ReconcileRow } from "@/lib/types";
import { formatVin } from "@/lib/vin";

function Section({
  title,
  hint,
  rows,
  empty,
}: {
  title: string;
  hint: string;
  rows: ReconcileRow[];
  empty: string;
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-lg font-black tracking-tight text-ink">{title}</h2>
      <p className="text-xs font-semibold text-slate-600">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-slate-500">{empty}</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-1.5 pr-2 font-extrabold">VIN</th>
              <th className="py-1.5 pr-2 font-extrabold">Unit</th>
              <th className="py-1.5 pr-2 font-extrabold">Stock</th>
              <th className="py-1.5 pr-2 font-extrabold">Books</th>
              <th className="py-1.5 font-extrabold">Walk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.vin}`} className="border-b border-slate-200 align-top">
                <td className="py-1.5 pr-2 font-mono font-bold">{formatVin(row.vin)}</td>
                <td className="py-1.5 pr-2">{vehicleLabel(row)}</td>
                <td className="py-1.5 pr-2">{row.stockNumber || "—"}</td>
                <td className="py-1.5 pr-2">{row.expectedLocationName || "—"}</td>
                <td className="py-1.5">
                  {row.scannedLocationName || "—"}
                  {row.scannerName ? ` · ${row.scannerName}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AuditPrintReport({
  meta,
  report,
}: {
  meta: AuditPrintMeta;
  report: ReconcileResult;
}) {
  const stamped = new Date(meta.generatedAt).toLocaleString();
  const baseline = meta.baselineUploadedAt
    ? new Date(meta.baselineUploadedAt).toLocaleString()
    : "Not uploaded";

  return (
    <div className="hidden bg-white p-6 text-ink print:block">
      <header className="border-b-2 border-ink pb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600">
          {APP_NAME} · Month-end lot audit
        </p>
        <h1 className="mt-1 text-3xl font-black">Walk Report & Discrepancy Report</h1>
        <p className="mt-1 text-sm font-semibold">
          {meta.dealershipName} · {meta.locationName}
        </p>
        <p className="text-xs text-slate-600">
          Prepared by {meta.generatedBy} · {stamped}
        </p>
        <p className="text-xs text-slate-600">
          {TERMS.dmsMasterBaseline} uploaded: {baseline}
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-4 gap-3 text-center">
        <div className="rounded border border-slate-300 p-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">On walk</dt>
          <dd className="text-2xl font-black">{report.scanned.length}</dd>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Missing</dt>
          <dd className="text-2xl font-black">{report.missing.length}</dd>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Unmatched</dt>
          <dd className="text-2xl font-black">{report.unmatched.length}</dd>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Misplaced</dt>
          <dd className="text-2xl font-black">{report.misplaced.length}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs font-semibold text-slate-600">
        <strong>{TERMS.dmsMasterList}:</strong> vehicles that should be on the lot per the books.{" "}
        <strong>
          {TERMS.scanList} / {TERMS.walkReport}:
        </strong>{" "}
        vehicles actually captured on this physical walk. Uploading a new baseline does not delete scan history.
      </p>

      <Section
        title={`${TERMS.scanList} / ${TERMS.walkReport}`}
        hint="Units found on the lot during this walk and matched to the DMS Master List."
        rows={report.scanned}
        empty="No matched scans on this walk."
      />
      <Section
        title="Missing from lot"
        hint="On the DMS Master List for this location, not found on the Scan List."
        rows={report.missing}
        empty="No missing units."
      />
      <Section
        title="Unmatched / not on books"
        hint="On the Scan List, but not on the DMS Master List."
        rows={report.unmatched}
        empty="No unmatched units."
      />
      <Section
        title="Misplaced"
        hint="Scanned at this location, but the DMS Master List expects a different lot."
        rows={report.misplaced}
        empty="No misplaced units."
      />

      <footer className="mt-8 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
        {APP_NAME} walk report · retain with month-end inventory files. Scan lists are independent of baseline uploads.
      </footer>
    </div>
  );
}
