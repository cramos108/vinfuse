"use client";

export type NativeBarcode = {
  rawValue: string;
  format: string;
};

type Detector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format?: string }>>;
};

type DetectorCtor = {
  new (options?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Side-window VIN stickers: 1D (Code 39/128) and 2D squares (Data Matrix / QR). */
export const NATIVE_VIN_FORMATS = ["code_39", "code_128", "data_matrix", "qr_code"] as const;

export function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

function detectorCtor(): DetectorCtor | null {
  if (!hasBarcodeDetector()) return null;
  return (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
}

export async function createVinBarcodeDetector(): Promise<Detector | null> {
  const Ctor = detectorCtor();
  if (!Ctor) return null;

  let formats: string[] = [...NATIVE_VIN_FORMATS];
  try {
    if (typeof Ctor.getSupportedFormats === "function") {
      const supported = await Ctor.getSupportedFormats();
      const allow = new Set(supported.map((f) => f.toLowerCase()));
      const matched = NATIVE_VIN_FORMATS.filter((f) => allow.has(f));
      if (matched.length) formats = matched;
    }
  } catch {
    /* keep requested formats */
  }

  try {
    return new Ctor({ formats });
  } catch {
    try {
      return new Ctor({ formats: ["code_39", "code_128"] });
    } catch {
      try {
        return new Ctor({ formats: ["code_39"] });
      } catch {
        return null;
      }
    }
  }
}

export async function detectVinBarcodes(
  detector: Detector,
  source: ImageBitmapSource,
): Promise<NativeBarcode[]> {
  const codes = await detector.detect(source);
  return codes
    .filter((c) => c.rawValue)
    .map((c) => ({ rawValue: c.rawValue, format: (c.format ?? "").toLowerCase() }));
}
