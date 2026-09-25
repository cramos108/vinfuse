"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Button, Card, Modal } from "@/components/ui";
import { PRIVACY_BODY, PRIVACY_HEADLINE, PRIVACY_SHORT } from "@/lib/privacy";

export function PrivacyCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="flex flex-col gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan/15 text-cyan">
          <Shield className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Security & Privacy</p>
          <h2 className="mt-1 text-xl font-black">{PRIVACY_HEADLINE}</h2>
          <p className="mt-2 text-sm font-semibold text-muted sunlight:text-slate-600">{PRIVACY_SHORT}</p>
        </div>
        <Button variant="line" onClick={() => setOpen(true)}>
          Read privacy terms
        </Button>
      </Card>
      <PrivacyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title={PRIVACY_HEADLINE} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm font-semibold leading-relaxed text-muted sunlight:text-slate-600">
        {PRIVACY_BODY.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </Modal>
  );
}
