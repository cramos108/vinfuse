const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;
const VIN_CHAR = /^[A-HJ-NPR-Z0-9]+$/;

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractVin(raw: string): string | null {
  const compact = normalizeVin(raw);
  if (isValidVin(compact)) return compact;
  const match = compact.match(VIN_RE) ?? raw.toUpperCase().match(VIN_RE);
  return match ? match[1] : null;
}

export function isValidVin(vin: string): boolean {
  return vin.length === 17 && VIN_CHAR.test(vin);
}

export function vinHint(vin: string): string | null {
  const v = normalizeVin(vin);
  if (!v) return "Enter a 17-character VIN.";
  if (v.length < 17) return `${v.length}/17 characters — keep scanning or typing.`;
  if (v.length > 17) return "Too long. VINs are exactly 17 characters.";
  if (/[IOQ]/.test(v)) return "VIN cannot contain I, O, or Q.";
  if (!VIN_CHAR.test(v)) return "VIN can only use letters A–Z (no I/O/Q) and digits.";
  return null;
}

export function formatVin(vin: string): string {
  const v = normalizeVin(vin);
  if (v.length !== 17) return v;
  return `${v.slice(0, 3)} ${v.slice(3, 9)} ${v.slice(9)}`;
}
