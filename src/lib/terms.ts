/** Canonical labels so lot staff and managers share the same language. */
export const TERMS = {
  dmsMasterList: "DMS Master List",
  dmsMasterBaseline: "DMS Master Baseline",
  scanList: "Scan List",
  walkReport: "Walk Report",
} as const;

export const TERM_DEFS = {
  dmsMasterList:
    "The imported file showing what vehicles should be on the lot according to the dealership's books.",
  scanList:
    "The actual list of vehicles captured by porters using the mobile camera during the physical lot audit.",
} as const;
