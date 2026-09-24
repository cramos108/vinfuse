"use client";

import { extractVinFromOcr, VIN_OCR_WHITELIST } from "./vin";

export type OcrVinResult = {
  vin: string | null;
  confidence: number;
  raw: string;
};

type TessWorker = {
  setParameters: (params: Record<string, string>) => Promise<void>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};

let worker: TessWorker | null = null;
let loading: Promise<TessWorker> | null = null;
let recognizing = false;

export function isOcrBusy(): boolean {
  return recognizing;
}

export async function getVinOcrWorker(): Promise<TessWorker> {
  if (worker) return worker;
  if (loading) return loading;
  loading = (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const next = (await createWorker("eng", 1, {
      logger: () => undefined,
    })) as unknown as TessWorker;
    await next.setParameters({
      tessedit_char_whitelist: VIN_OCR_WHITELIST,
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    worker = next;
    return next;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export async function recognizeVinFromCanvas(canvas: HTMLCanvasElement): Promise<OcrVinResult> {
  if (recognizing) return { vin: null, confidence: 0, raw: "" };
  recognizing = true;
  try {
    const ocr = await getVinOcrWorker();
    const { data } = await ocr.recognize(canvas);
    const raw = (data.text ?? "").replace(/\s+/g, "");
    return {
      vin: extractVinFromOcr(data.text ?? ""),
      confidence: data.confidence ?? 0,
      raw,
    };
  } finally {
    recognizing = false;
  }
}

export async function terminateVinOcr() {
  const current = worker;
  worker = null;
  loading = null;
  recognizing = false;
  if (current) await current.terminate();
}

export function enhanceOcrFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const cropW = Math.floor(vw * 0.94);
  const cropH = Math.max(110, Math.floor(vh * 0.32));
  const sx = Math.floor((vw - cropW) / 2);
  const sy = Math.floor((vh - cropH) / 2);
  const outW = Math.min(1280, cropW);
  const outH = Math.max(120, Math.round((cropH / cropW) * outW));
  canvas.width = outW;
  canvas.height = outH;
  ctx.filter = "grayscale(1) contrast(1.7) brightness(1.12)";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outW, outH);
  ctx.filter = "none";
  return canvas;
}
