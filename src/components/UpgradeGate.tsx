"use client";

import { Lock } from "lucide-react";
import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { Card } from "@/components/ui";
import { PRO_PRICE_LABEL } from "@/lib/brand";

export function UpgradeGate({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card className="flex flex-col items-start gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan/15 text-cyan">
        <Lock className="h-6 w-6" />
      </span>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro · {PRO_PRICE_LABEL}</p>
        <h2 className="mt-1 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-base font-semibold text-muted sunlight:text-slate-600">{body}</p>
      </div>
      <ProCheckoutButton label={`Unlock Pro · ${PRO_PRICE_LABEL}`} />
    </Card>
  );
}
