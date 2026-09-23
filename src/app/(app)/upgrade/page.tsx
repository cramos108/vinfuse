"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useAuth, useRequiredSession } from "@/components/AuthProvider";
import { Button, Card } from "@/components/ui";
import { PRO_PRICE_LABEL } from "@/lib/brand";
import { PLANS, isPro } from "@/lib/plan";
import { setPlan } from "@/lib/store";

export default function UpgradePage() {
  const session = useRequiredSession();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pro = isPro(session.dealership);

  async function activate(plan: "free" | "pro") {
    setBusy(true);
    setError(null);
    try {
      await setPlan(session, plan);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">LeadFuse ecosystem</p>
        <h1 className="text-3xl font-black">VinFuse Pro</h1>
        <p className="font-semibold text-muted sunlight:text-slate-600">
          {PRO_PRICE_LABEL}. Unlock DMS import, three locations, discrepancy reports, and team logins.
        </p>
      </div>
      <Card className="border-cyan">
        <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">Pro</p>
        <p className="text-4xl font-black">{PRO_PRICE_LABEL}</p>
        <ul className="mt-4 flex flex-col gap-2 font-semibold">
          {PLANS.pro.features.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
              {item}
            </li>
          ))}
        </ul>
        <Button className="mt-6 w-full" disabled={busy || pro} onClick={() => void activate("pro")}>
          {pro ? "Pro is active" : `Activate Pro · ${PRO_PRICE_LABEL}`}
        </Button>
        <p className="mt-3 text-xs font-semibold text-muted">
          Demo billing is in-app so you can test gates now. Wire Stripe in production before charging dealers.
        </p>
      </Card>
      <Card>
        <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Free</p>
        <ul className="mt-3 flex flex-col gap-2 font-semibold">
          {PLANS.free.features.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        {pro ? (
          <Button variant="line" className="mt-4 w-full" disabled={busy} onClick={() => void activate("free")}>
            Downgrade to Free
          </Button>
        ) : null}
      </Card>
      {error ? <p className="font-bold text-alert">{error}</p> : null}
    </div>
  );
}
