import type { Dealership, Location, LocationKind, Plan, Role } from "./types";
import { PRO_PRICE_LABEL } from "./brand";

export const FREE_MAX_LOCATIONS = 1;
export const FREE_MAX_VINS_PER_AUDIT = 100;

export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    priceLabel: "$0",
    features: [
      "Up to 100 scanned units/VINs per audit",
      "Single location",
      "Scan List / Walk Report of camera captures",
      "Print / share walks + local history on this device",
      "Add to home screen (PWA)",
    ],
    locked: [
      "DMS Master List (baseline) import",
      "Automated discrepancy reports",
      "Multi-location switcher",
      "Multi-user team logins",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    priceLabel: PRO_PRICE_LABEL,
    features: [
      "Unlimited scanned units/VINs per audit",
      "DMS Master Baseline for the current audit",
      "Unlimited sales lots and service centers",
      "Printable Walk Report + discrepancy PDF",
      "Unlimited team logins (managers + lot porters)",
    ],
    locked: [] as string[],
  },
} as const;

export function isPro(dealership?: Pick<Dealership, "plan"> | null): boolean {
  return String(dealership?.plan ?? "").toLowerCase() === "pro";
}

export function isManager(role?: Role | null): boolean {
  return role === "manager";
}

export function canImportCsv(dealership: Dealership, role: Role): boolean {
  return isPro(dealership) && isManager(role);
}

export function canReconcile(dealership: Dealership): boolean {
  return isPro(dealership);
}

export function canInviteTeam(dealership: Dealership, role: Role): boolean {
  return isPro(dealership) && isManager(role);
}

export function canSwitchLocations(dealership: Dealership): boolean {
  return isPro(dealership);
}

export function canAddLocation(
  dealership: Dealership,
  locations: Location[],
  _kind: LocationKind,
): string | null {
  if (isPro(dealership)) return null;
  if (locations.length >= FREE_MAX_LOCATIONS) {
    return "Free includes one location. Upgrade to Pro to add sales lots and service centers.";
  }
  return null;
}

export function planLabel(plan?: Plan | null): string {
  return plan === "pro" ? "Pro" : "Free";
}

export function uniqueVinCount(vins: Array<{ vin: string }>): number {
  return new Set(vins.map((row) => row.vin)).size;
}

export function vinCapReached(dealership: Pick<Dealership, "plan">, uniqueCount: number): boolean {
  if (isPro(dealership)) return false;
  return uniqueCount >= FREE_MAX_VINS_PER_AUDIT;
}

export function vinCapRemaining(dealership: Pick<Dealership, "plan">, uniqueCount: number): number | null {
  if (isPro(dealership)) return null;
  return Math.max(0, FREE_MAX_VINS_PER_AUDIT - uniqueCount);
}
