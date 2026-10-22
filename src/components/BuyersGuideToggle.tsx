"use client";

import {
  BUYERS_GUIDE_STATUS_LABEL,
  BUYERS_GUIDE_TERMS_LABEL,
  BUYERS_GUIDE_TOOLTIP,
  buyersGuideCycle,
  formatBuyersGuideWhen,
  intervalLabel,
} from "@/lib/buyersGuide";
import type {
  BuyersGuideInterval,
  BuyersGuideRecord,
  BuyersGuideStatus,
  BuyersGuideTerms,
} from "@/lib/types";

const BADGE_CLASS: Record<BuyersGuideStatus, string> = {
  present: "border-ok bg-ok/15 text-ok",
  recommended: "border-warn bg-warn/15 text-warn",
};

export function BuyersGuideHint({ className = "" }: { className?: string }) {
  return (
    <p title={BUYERS_GUIDE_TOOLTIP} className={`text-sm font-semibold text-muted sunlight:text-slate-600 ${className}`}>
      {BUYERS_GUIDE_TOOLTIP}
    </p>
  );
}

export function BuyersGuideBadge({
  status,
  termsChangeRequired = false,
}: {
  status: BuyersGuideStatus;
  termsChangeRequired?: boolean;
}) {
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      <span
        title={BUYERS_GUIDE_TOOLTIP}
        className={`inline-flex rounded-full border-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${BADGE_CLASS[status]}`}
      >
        {BUYERS_GUIDE_STATUS_LABEL[status]}
      </span>
      {termsChangeRequired ? (
        <span
          title="Vehicle terms changed. Print and post a new physical Buyers Guide before sale."
          className="inline-flex rounded-full border-2 border-alert bg-alert/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-alert"
        >
          Reprint required
        </span>
      ) : null}
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
      title={BUYERS_GUIDE_TOOLTIP}
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
  interval,
  walkStartedAt = null,
  busy = false,
  compact = false,
  onVerify,
  onTermsChange,
}: {
  record: BuyersGuideRecord | null;
  interval: BuyersGuideInterval;
  walkStartedAt?: string | null;
  busy?: boolean;
  compact?: boolean;
  onVerify: () => void;
  onTermsChange?: (required: boolean, terms: BuyersGuideTerms | null) => void;
}) {
  const cycle = buyersGuideCycle(record, { interval, walkStartedAt });
  const terms = record?.terms ?? null;

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">Lot inspection</p>
          <p className="text-sm font-bold">{cycle.label}</p>
        </div>
        <BuyersGuideBadge status={cycle.status} termsChangeRequired={cycle.termsChangeRequired} />
      </div>

      {!compact ? <BuyersGuideHint /> : null}

      <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
        Last checked {formatBuyersGuideWhen(cycle.buyersGuideVerifiedAt)}
        {record?.verifierName ? ` · ${record.verifierName}` : ""}
        {cycle.daysElapsed !== null ? ` · ${cycle.daysElapsed} day${cycle.daysElapsed === 1 ? "" : "s"} ago` : ""}
        {` · cadence: ${intervalLabel(interval)}`}
      </p>

      {cycle.status === "present" ? (
        <p className="text-sm font-semibold text-ok">
          Sticker was physically re-checked within the dealership inspection interval.
        </p>
      ) : (
        <p className="text-sm font-bold text-warn">
          Inspection recommended. Confirm the window sticker is present, undamaged, and matches current terms.
        </p>
      )}

      {cycle.termsChangeRequired ? (
        <p className="text-sm font-bold text-alert">
          Terms changed{terms ? ` to ${BUYERS_GUIDE_TERMS_LABEL[terms]}` : ""}. Print and post a new physical Buyers
          Guide before sale.
        </p>
      ) : null}

      <BuyersGuideVerifyButton busy={busy} compact={compact} onVerify={onVerify} />

      {onTermsChange ? (
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm font-bold">Terms changed — reprint Buyers Guide</span>
            <button
              type="button"
              role="switch"
              aria-checked={cycle.termsChangeRequired}
              disabled={busy}
              title="Flag that vehicle terms changed (for example As-Is to Dealer Warranty). A new physical Buyers Guide must be printed and posted before sale."
              onClick={() => onTermsChange(!cycle.termsChangeRequired, terms)}
              className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition ${
                cycle.termsChangeRequired
                  ? "border-alert bg-alert"
                  : "border-line bg-navy-3 sunlight:bg-slate-200 sunlight:border-slate-400"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  cycle.termsChangeRequired ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </label>
          {!compact ? (
            <select
              className="min-h-11 rounded-xl border-2 border-line bg-navy-2 px-3 text-sm font-bold sunlight:bg-white sunlight:border-slate-300"
              value={terms ?? ""}
              disabled={busy}
              aria-label="Posted Buyers Guide terms"
              onChange={(event) => {
                const next = event.target.value as BuyersGuideTerms | "";
                onTermsChange(cycle.termsChangeRequired || Boolean(next), next || null);
              }}
            >
              <option value="">Posted terms</option>
              <option value="as_is">As-Is</option>
              <option value="dealer_warranty">Dealer Warranty</option>
            </select>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
