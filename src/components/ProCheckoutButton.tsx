"use client";

import { PRO_PRICE_LABEL, STRIPE_PRO_URL } from "@/lib/brand";

export function ProCheckoutButton({
  label,
}: {
  label?: string;
}) {
  return (
    <a
      href={STRIPE_PRO_URL}
      rel="noreferrer"
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-cyan bg-cyan px-5 text-base font-extrabold uppercase tracking-wide text-cyan-ink shadow-[0_0_24px_rgba(34,211,238,0.35)]"
    >
      {label ?? `Go Pro · ${PRO_PRICE_LABEL}`}
    </a>
  );
}
