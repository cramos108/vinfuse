/** ISO 3779 VIN: 17 chars, A–H J–N P R–Z 0–9 (never I, O, or Q). */
export const VIN_REGEX = /(?:^|[^A-HJ-NPR-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-HJ-NPR-Z0-9])/gi;
const VIN_CHUNK = /[A-HJ-NPR-Z0-9]{17}/g;
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
    .replace(/I/g, "1")
    .replace(/[OQ]/g, "0")
    .replace(/\|/g, "1");
}

const CONFUSION_SWAPS: Array<[string, string]> = [
  ["5", "S"],
  ["S", "5"],
  ["8", "B"],
  ["B", "8"],
  ["2", "Z"],
  ["Z", "2"],
  ["6", "G"],
  ["G", "6"],
  ["0", "D"],
  ["D", "0"],
];

function rescueCheckDigit(vin: string): string {
  if (vin.length !== 17) return vin;
  if (hasValidVinCheckDigit(vin)) return vin;
  const hits: string[] = [];
  for (let i = 0; i < 17; i++) {
    for (const [from, to] of CONFUSION_SWAPS) {
      if (vin[i] !== from) continue;
      const next = vin.slice(0, i) + to + vin.slice(i + 1);
      if (isValidVin(next) && hasValidVinCheckDigit(next)) hits.push(next);
    }
  }
  return hits.length === 1 ? hits[0] : vin;
}

/**
 * Strict 17-character guard: strip illegal symbols, map I→1 / O|Q→0 / S↔5 confusions,
 * and return text to show immediately plus a VIN when the pattern matches.
 */
export function cleanOcrVinCandidate(raw: string): { display: string; vin: string | null } {
  const mapped = correctOcrVinText(raw);
  const match = firstValidVin(mapped);
  if (match) {
    const rescued = rescueCheckDigit(match);
    return { display: rescued, vin: rescued };
  }
  if (mapped.length === 17 && isValidVin(mapped)) {
    const rescued = rescueCheckDigit(mapped);
    return { display: rescued, vin: rescued };
  }
  if (mapped.length > 17) {
    const windowed = mapped.match(VIN_CHUNK) ?? [];
    const best = windowed.map(rescueCheckDigit).find((v) => isValidVin(v)) ?? null;
    if (best) return { display: best, vin: best };
    return { display: mapped.slice(0, 17), vin: null };
  }
  return { display: mapped, vin: null };
}

export function extractVin(raw: string): string | null {
  return firstValidVin(raw);
}

export function extractVinsByRegex(raw: string): string[] {
  const found = new Set<string>();
  const corrected = correctOcrVinText(raw);
  if (isValidVin(corrected)) found.add(corrected);

  VIN_REGEX.lastIndex = 0;
  const spaced = raw.toUpperCase().replace(/[IOQ]/g, (ch) => (ch === "I" ? "1" : "0"));
  let m: RegExpExecArray | null;
  while ((m = VIN_REGEX.exec(spaced))) {
    if (isValidVin(m[1])) found.add(m[1]);
  }

  const compact = correctOcrVinText(raw.replace(/[\s.\-_]+/g, ""));
  const chunks = compact.match(VIN_CHUNK) ?? [];
  for (const chunk of chunks) {
    if (isValidVin(chunk)) found.add(chunk);
  }
  return [...found];
}

export function firstValidVin(raw: string): string | null {
  const vins = extractVinsByRegex(raw);
  if (!vins.length) return null;
  return vins.find(hasValidVinCheckDigit) ?? vins[0];
}

export function extractVinFromOcr(raw: string): string | null {
  return firstValidVin(raw);
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
