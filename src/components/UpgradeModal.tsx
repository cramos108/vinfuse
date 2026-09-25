"use client";

import Link from "next/link";
import { Button, Modal } from "@/components/ui";
import { PRO_PRICE_LABEL } from "@/lib/brand";
import { FREE_MAX_VINS_PER_AUDIT } from "@/lib/plan";

export function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Walk limit reached" onClose={onClose}>
      <p className="font-semibold text-muted sunlight:text-slate-600">
        Free includes up to {FREE_MAX_VINS_PER_AUDIT} scanned units/VINs per audit. Go Pro for unlimited scanning,
        multiple lot locations, and team logins.
      </p>
      <p className="mt-3 text-3xl font-black text-cyan">{PRO_PRICE_LABEL}</p>
      <ul className="mt-3 flex flex-col gap-1 text-sm font-semibold">
        <li>• Unlimited VINs per walk</li>
        <li>• Unlimited sales lots and service centers</li>
        <li>• Team logins for managers and lot porters</li>
      </ul>
      <Link href="/upgrade" className="mt-5 block">
        <Button className="w-full">Go Pro · {PRO_PRICE_LABEL}</Button>
      </Link>
      <Button variant="line" className="mt-3 w-full" onClick={onClose}>
        Keep this walk at {FREE_MAX_VINS_PER_AUDIT}
      </Button>
    </Modal>
  );
}
