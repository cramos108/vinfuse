"use client";

import { MapPin } from "lucide-react";
import { Select } from "@/components/ui";
import { STRIPE_PRO_URL } from "@/lib/brand";
import type { Dealership, Location } from "@/lib/types";
import { canSwitchLocations } from "@/lib/plan";

export function LocationSwitcher({
  dealership,
  locations,
  value,
  onChange,
}: {
  dealership: Dealership;
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  const pro = canSwitchLocations(dealership);
  const current = locations.find((l) => l.id === value);

  if (!pro) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-cyan" />
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Location</p>
            <p className="text-base font-black">{current?.name ?? "Main Lot"}</p>
          </div>
        </div>
        <a href={STRIPE_PRO_URL} className="text-xs font-extrabold uppercase tracking-wide text-cyan">
          Unlock lots
        </a>
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">
        <MapPin className="h-4 w-4" />
        Active location
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name} · {loc.kind === "service_center" ? "Service" : "Sales lot"}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function kindLabel(kind: Location["kind"]): string {
  return kind === "service_center" ? "Service center" : "Sales lot";
}
