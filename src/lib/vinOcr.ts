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

type ImageCaptureLike = {
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
  grabFrame: () => Promise<ImageBitmap>;
  getPhotoCapabilities?: () => Promise<{
    imageWidth?: { min: number; max: number };
    imageHeight?: { min: number; max: number };
  }>;
};

let worker: TessWorker | null = null;
let loading: Promise<TessWorker> | null = null;
let recognizing = false;
let psmLine = "7";
let psmBlock = "6";

export function isOcrBusy(): boolean {
  return recognizing;
}

export async function getVinOcrWorker(): Promise<TessWorker> {
  if (worker) return worker;
  if (loading) return loading;
  loading = (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    psmLine = PSM.SINGLE_LINE;
    psmBlock = PSM.SINGLE_BLOCK;
    const next = (await createWorker("eng", 1, {
      logger: () => undefined,
    })) as unknown as TessWorker;
    await next.setParameters({
      tessedit_char_whitelist: VIN_OCR_WHITELIST,
      tessedit_pageseg_mode: psmLine,
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

async function waitForIdle() {
  while (recognizing) {
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
}

export async function recognizeVinFromCanvas(
  canvas: HTMLCanvasElement,
  options?: { wait?: boolean; retryBlock?: boolean },
): Promise<OcrVinResult> {
  if (recognizing) {
    if (!options?.wait) return { vin: null, confidence: 0, raw: "" };
    await waitForIdle();
  }
  recognizing = true;
  try {
    const ocr = await getVinOcrWorker();
    const first = await ocr.recognize(canvas);
    const firstText = first.data.text ?? "";
    const firstVin = extractVinFromOcr(firstText);
    if (firstVin || !options?.retryBlock) {
      return {
        vin: firstVin,
        confidence: first.data.confidence ?? 0,
        raw: firstText.replace(/\s+/g, ""),
      };
    }
    await ocr.setParameters({ tessedit_pageseg_mode: psmBlock });
    const second = await ocr.recognize(canvas);
    await ocr.setParameters({ tessedit_pageseg_mode: psmLine });
    const secondText = second.data.text ?? "";
    return {
      vin: extractVinFromOcr(secondText) ?? extractVinFromOcr(`${firstText}\n${secondText}`),
      confidence: Math.max(first.data.confidence ?? 0, second.data.confidence ?? 0),
      raw: secondText.replace(/\s+/g, "") || firstText.replace(/\s+/g, ""),
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

function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  if (source instanceof HTMLCanvasElement) return { w: source.width, h: source.height };
  return { w: 0, h: 0 };
}

function applyGreyscaleContrast(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const range = Math.max(1, max - min);
  const contrast = 1.85;
  for (let i = 0; i < data.length; i += 4) {
    let y = ((data[i] - min) / range) * 255;
    y = (y - 128) * contrast + 128;
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    data[i] = data[i + 1] = data[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
}

/** Crop the VIN band, convert to greyscale, and stretch contrast for door/dash plates. */
export function preprocessVinSnapshot(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
  band: "barcode" | "plate" = "plate",
): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { w, h } = sourceSize(source);
  if (!w || !h) return null;

  const cropW = Math.floor(w * 0.94);
  const cropH = Math.max(band === "plate" ? 140 : 80, Math.floor(h * (band === "plate" ? 0.36 : 0.24)));
  const sx = Math.floor((w - cropW) / 2);
  const sy = Math.floor((h - cropH) / 2);
  const outW = Math.min(2560, cropW);
  const outH = Math.max(140, Math.round((cropH / cropW) * outW));
  canvas.width = outW;
  canvas.height = outH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, outW, outH);
  applyGreyscaleContrast(canvas);
  return canvas;
}

export function enhanceOcrFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  return preprocessVinSnapshot(video, canvas, "plate");
}

export async function captureHighResStill(
  stream: MediaStream,
  video: HTMLVideoElement,
): Promise<CanvasImageSource> {
  const track = stream.getVideoTracks()[0];
  const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike })
    .ImageCapture;
  if (ImageCaptureCtor && track) {
    const capture = new ImageCaptureCtor(track);
    try {
      let imageWidth: number | undefined;
      try {
        const caps = await capture.getPhotoCapabilities?.();
        imageWidth = caps?.imageWidth?.max;
      } catch {
        /* some devices omit photo capabilities */
      }
      const blob = await capture.takePhoto(imageWidth ? { imageWidth } : undefined);
      return await createImageBitmap(blob);
    } catch {
      try {
        return await capture.grabFrame();
      } catch {
        /* fall through to the live video frame */
      }
    }
  }
  return video;
}
