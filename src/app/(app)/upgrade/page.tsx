"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth, useRequiredSession } from "@/components/AuthProvider";
import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { Button, Card } from "@/components/ui";
import { PRO_PRICE_LABEL } from "@/lib/brand";
import { PLANS, clearDevPro, isDevPro, isPro } from "@/lib/plan";
import { setPlan } from "@/lib/store";

export default function UpgradePage() {
  const session = useRequiredSession();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pro = isPro(session.dealership);
  const demoPro = isDevPro();

  async function downgrade() {
    setBusy(true);
    setError(null);
    try {
      if (demoPro) clearDevPro();
      if (session.kind === "cloud") await setPlan(session, "free");
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
          {PRO_PRICE_LABEL}. Unlimited VINs, unlimited lots, discrepancy reports, and team logins.
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
        {pro ? (
          <Button className="mt-6 w-full" disabled>
            Pro is active{demoPro ? " · demo" : ""}
          </Button>
        ) : (
          <div className="mt-6">
            <ProCheckoutButton label={`Subscribe · ${PRO_PRICE_LABEL}`} />
          </div>
        )}
        <p className="mt-3 text-xs font-semibold text-muted">
          Checkout is handled securely by Stripe. After payment, your dealership workspace unlocks Pro.
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
          <Button variant="line" className="mt-4 w-full" disabled={busy} onClick={() => void downgrade()}>
            {demoPro ? "Turn off demo Pro" : "Downgrade to Free"}
          </Button>
        ) : (
          <Link href="/scan" className="mt-4 block">
            <Button variant="line" className="w-full">
              Continue on Free
            </Button>
          </Link>
        )}
      </Card>
      {error ? <p className="font-bold text-alert">{error}</p> : null}
    </div>
  );
}
