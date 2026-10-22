"use client";

import {
  BUYERS_GUIDE_STATUS_LABEL,
  BUYERS_GUIDE_VALID_MAX_DAYS,
  BUYERS_GUIDE_WARNING_MAX_DAYS,
  buyersGuideCycle,
  formatBuyersGuideWhen,
} from "@/lib/buyersGuide";
import type { BuyersGuideRecord, BuyersGuideStatus } from "@/lib/types";

const BADGE_CLASS: Record<BuyersGuideStatus, string> = {
  valid: "border-ok bg-ok/15 text-ok",
  warning: "border-warn bg-warn/15 text-warn",
  expired: "border-alert bg-alert/15 text-alert",
};

export function BuyersGuideBadge({ status }: { status: BuyersGuideStatus }) {
  return (
    <span
      className={`mt-1 inline-flex rounded-full border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${BADGE_CLASS[status]}`}
    >
      {BUYERS_GUIDE_STATUS_LABEL[status]}
    </span>
  );
}

export function BuyersGuideVerifyButton({
  busy = false,
  compact = false,
  onVerify,
}: {
  busy?: boolean;
  compact?: boolean;
  onVerify: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onVerify();
      }}
      className={`rounded-xl border-2 border-ok bg-ok/15 px-3 text-xs font-extrabold uppercase tracking-wide text-ok disabled:opacity-60 ${
        compact ? "min-h-11 w-full" : "min-h-12 w-full"
      }`}
    >
      {busy ? "Saving…" : "Verify Buyers Guide Present"}
    </button>
  );
}

export function BuyersGuideToggle({
  record,
  busy = false,
  compact = false,
  onVerify,
}: {
  record: BuyersGuideRecord | null;
  busy?: boolean;
  compact?: boolean;
  onVerify: () => void;
}) {
  const cycle = buyersGuideCycle(record);

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Buyers Guide</p>
          <p className="text-sm font-bold">{cycle.label}</p>
        </div>
        <BuyersGuideBadge status={cycle.status} />
      </div>

      <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
        Last verified {formatBuyersGuideWhen(cycle.buyersGuideVerifiedAt)}
        {record?.verifierName ? ` · ${record.verifierName}` : ""}
        {cycle.daysElapsed !== null ? ` · ${cycle.daysElapsed} day${cycle.daysElapsed === 1 ? "" : "s"} elapsed` : ""}
      </p>

      {cycle.status === "valid" ? (
        <p className="text-sm font-semibold text-ok">
          Compliant (green). Re-check due after {BUYERS_GUIDE_VALID_MAX_DAYS} days
          {cycle.warningAt ? ` · ${formatBuyersGuideWhen(cycle.warningAt)}` : ""}.
        </p>
      ) : null}

      {cycle.status === "warning" ? (
        <p className="text-sm font-bold text-warn">
          Re-check due (amber). Inspect this window sticker on the next lot walk. High risk after{" "}
          {BUYERS_GUIDE_WARNING_MAX_DAYS} days.
        </p>
      ) : null}

      {cycle.status === "expired" ? (
        <p className="text-sm font-bold text-alert">
          Non-compliant / missing (red). Unverified or past {BUYERS_GUIDE_WARNING_MAX_DAYS} days — high audit risk.
        </p>
      ) : null}

      <BuyersGuideVerifyButton busy={busy} compact={compact} onVerify={onVerify} />
    </div>
  );
}
