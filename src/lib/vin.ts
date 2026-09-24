const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;
const VIN_CHAR = /^[A-HJ-NPR-Z0-9]+$/;
const VIN_WHITELIST = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const TRANSLITERATE: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

/** Characters Tesseract may emit for a VIN plate. I/O/Q are not legal VIN letters. */
export const VIN_OCR_WHITELIST = VIN_WHITELIST;

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Map lookalikes OCR commonly confuses with legal VIN characters. */
export function correctOcrVinText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9|]/g, "")
    .replace(/[IOQ]/g, (ch) => (ch === "I" ? "1" : "0"))
    .replace(/\|/g, "1");
}

export function extractVin(raw: string): string | null {
  const compact = normalizeVin(raw);
  if (isValidVin(compact)) return compact;
  const match = compact.match(VIN_RE) ?? raw.toUpperCase().match(VIN_RE);
  return match ? match[1] : null;
}

export function extractVinFromOcr(raw: string): string | null {
  const compact = correctOcrVinText(raw);
  if (isValidVin(compact)) return compact;
  const matches = compact.match(/[A-HJ-NPR-Z0-9]{17}/g);
  if (!matches?.length) return extractVin(raw);
  const ranked = [...matches].sort((a, b) => Number(hasValidVinCheckDigit(b)) - Number(hasValidVinCheckDigit(a)));
  return ranked[0] ?? null;
}

export function isValidVin(vin: string): boolean {
  return vin.length === 17 && VIN_CHAR.test(vin) && !/[IOQ]/.test(vin);
}

function vinCharValue(char: string): number {
  if (char >= "0" && char <= "9") return Number(char);
  return TRANSLITERATE[char] ?? 0;
}

/** ISO 3779 check digit (position 9). Extra confidence signal for OCR, not required for barcode scans. */
export function hasValidVinCheckDigit(vin: string): boolean {
  if (!isValidVin(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += vinCharValue(vin[i]) * WEIGHTS[i];
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return vin[8] === expected;
}

export function isConfidentOcrVin(vin: string, tesseractConfidence: number, consecutiveHits: number): boolean {
  if (!isValidVin(vin)) return false;
  if (hasValidVinCheckDigit(vin)) return true;
  if (tesseractConfidence >= 70) return true;
  return consecutiveHits >= 2;
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
