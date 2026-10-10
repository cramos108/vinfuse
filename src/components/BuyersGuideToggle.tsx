"use client";

import { BUYERS_GUIDE_CYCLE_DAYS, buyersGuideCycle, formatBuyersGuideWhen } from "@/lib/buyersGuide";
import type { BuyersGuideRecord, BuyersGuideStatus } from "@/lib/types";

const BADGE_CLASS: Record<BuyersGuideStatus, string> = {
  verified: "border-ok bg-ok/15 text-ok",
  overdue: "border-warn bg-warn/15 text-warn",
  missing: "border-alert bg-alert/15 text-alert",
};

export function BuyersGuideBadge({ status }: { status: BuyersGuideStatus }) {
  const label =
    status === "verified" ? "Verified" : status === "overdue" ? "Audit Overdue" : "Missing Guide";
  return (
    <span
      className={`mt-1 inline-flex rounded-full border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${BADGE_CLASS[status]}`}
    >
      {label}
    </span>
  );
}

export function BuyersGuideToggle({
  record,
  busy = false,
  compact = false,
  onChange,
}: {
  record: BuyersGuideRecord | null;
  busy?: boolean;
  compact?: boolean;
  onChange: (verified: boolean) => void;
}) {
  const cycle = buyersGuideCycle(record);
  const posted = Boolean(record?.verified);
  const showRenew = posted && cycle.status === "overdue";

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Buyers Guide Verified</p>
          <p className="text-sm font-bold">{cycle.label}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={posted}
          aria-label="Buyers Guide Verified"
          disabled={busy}
          onClick={() => onChange(!posted)}
          className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition ${
            posted ? "border-ok bg-ok" : "border-line bg-navy-3 sunlight:bg-slate-200 sunlight:border-slate-400"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              posted ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
        Last verified {formatBuyersGuideWhen(cycle.lastVerifiedAt)}
        {record?.verifierName ? ` · ${record.verifierName}` : ""}
      </p>

      {cycle.status === "verified" && cycle.expiresAt ? (
        <p className="text-sm font-semibold text-ok">
          Current through {formatBuyersGuideWhen(cycle.expiresAt)}
          {cycle.daysRemaining !== null ? ` · ${cycle.daysRemaining} day${cycle.daysRemaining === 1 ? "" : "s"} left` : ""}
        </p>
      ) : null}

      {cycle.status === "overdue" ? (
        <p className="text-sm font-bold text-warn">
          Window sticker verification expired after {BUYERS_GUIDE_CYCLE_DAYS} days. Re-verify this unit.
        </p>
      ) : null}

      {cycle.status === "missing" ? (
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          No window sticker verification on file. Toggle on after the FTC Buyers Guide is posted on the vehicle.
        </p>
      ) : null}

      {showRenew ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange(true)}
          className="min-h-11 rounded-xl border-2 border-warn px-3 text-xs font-extrabold uppercase tracking-wide text-warn"
        >
          Re-verify window sticker
        </button>
      ) : null}
    </div>
  );
}