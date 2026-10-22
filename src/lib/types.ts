export type Plan = "free" | "pro";
export type Role = "manager" | "porter";
export type LocationKind = "sales_lot" | "service_center";
export type ScanSource = "barcode" | "manual" | "ocr";
export type AuditStatus = "open" | "closed";
export type BuyersGuideStatus = "present" | "recommended";
export type BuyersGuideFilter = "all" | "present" | "recommended" | "terms";
export type BuyersGuideInterval = 14 | 30 | "walk";
export type BuyersGuideTerms = "as_is" | "dealer_warranty";

export type Dealership = {
  id: string;
  name: string;
  plan: Plan;
  createdAt: string;
};

export type Location = {
  id: string;
  dealershipId: string;
  name: string;
  kind: LocationKind;
};

export type Profile = {
  id: string;
  dealershipId: string;
  email: string;
  fullName: string;
  role: Role;
};

export type AuthKind = "local" | "cloud";

export type AuthSession = {
  user: Profile;
  dealership: Dealership;
  kind: AuthKind;
};

export type AuditSession = {
  id: string;
  dealershipId: string;
  locationId: string;
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  status: AuditStatus;
};

export type Scan = {
  id: string;
  dealershipId: string;
  sessionId: string;
  locationId: string;
  locationName: string;
  vin: string;
  scannedBy: string;
  scannerName: string;
  scannedAt: string;
  source: ScanSource;
  buyersGuideVerifiedAt?: string | null;
  buyersGuideStatus?: BuyersGuideStatus;
  termsChangeRequired?: boolean;
};

/** FTC Used Car Rule window-sticker (Buyers Guide) verification. */
export type BuyersGuideRecord = {
  vin: string;
  dealershipId: string;
  buyersGuideVerifiedAt: string | null;
  buyersGuideStatus: BuyersGuideStatus;
  verifiedBy: string | null;
  verifierName: string | null;
  terms: BuyersGuideTerms | null;
  termsChangeRequired: boolean;
  termsChangedAt: string | null;
  updatedAt: string;
};

export type InventoryItem = {
  id: string;
  dealershipId: string;
  vin: string;
  stockNumber: string;
  year: string;
  make: string;
  model: string;
  color: string;
  expectedLocationName: string;
  expectedLocationId: string | null;
  importedAt: string;
};

export type Invite = {
  id: string;
  dealershipId: string;
  code: string;
  email: string;
  role: Role;
  createdAt: string;
  usedAt: string | null;
};

export type ReconcileRow = {
  vin: string;
  stockNumber: string;
  year: string;
  make: string;
  model: string;
  color: string;
  expectedLocationName: string;
  scannedLocationName: string;
  scannedAt: string | null;
  scannerName: string;
};

export type ReconcileResult = {
  scanned: ReconcileRow[];
  missing: ReconcileRow[];
  unmatched: ReconcileRow[];
  misplaced: ReconcileRow[];
};
