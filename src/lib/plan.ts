import type { Dealership, Location, LocationKind, Plan, Role } from "./types";
import { PRO_PRICE_LABEL } from "./brand";

export const FREE_MAX_LOCATIONS = 1;
export const PRO_MAX_SALES_LOTS = 2;
export const PRO_MAX_SERVICE = 1;

export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    priceLabel: "$0",
    features: [
      "Unlimited camera VIN / barcode scanning",
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
      "Everything in Free",
      "DMS Master Baseline for the current audit",
      "2 sales lots + 1 service center",
      "Printable Walk Report + discrepancy PDF",
      "Unlimited team logins (managers + lot porters)",
    ],
    locked: [] as string[],
  },
} as const;

export function isPro(dealership?: Pick<Dealership, "plan"> | null): boolean {
  return dealership?.plan === "pro";
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
  kind: LocationKind,
): string | null {
  if (!isPro(dealership)) {
    if (locations.length >= FREE_MAX_LOCATIONS) {
      return "Free includes one location. Upgrade to Pro for 2 sales lots + a service center.";
    }
    return null;
  }
  const sales = locations.filter((l) => l.kind === "sales_lot").length;
  const service = locations.filter((l) => l.kind === "service_center").length;
  if (kind === "sales_lot" && sales >= PRO_MAX_SALES_LOTS) {
    return "Pro includes 2 sales lots.";
  }
  if (kind === "service_center" && service >= PRO_MAX_SERVICE) {
    return "Pro includes 1 service center.";
  }
  return null;
}

export function planLabel(plan?: Plan | null): string {
  return plan === "pro" ? "Pro" : "Free";
}
