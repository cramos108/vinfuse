"use client";

import { cleanOcrVinCandidate, extractVinFromOcr, VIN_OCR_WHITELIST } from "./vin";

const VIN_BLACKLIST = "IOQioq!@#$%^&*()[]{}.,;:'\"<>?/\\+=~`_";

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
    }, {
      load_system_dawg: "0",
      load_freq_dawg: "0",
      load_punc_dawg: "0",
    })) as unknown as TessWorker;
    await next.setParameters({
      tessedit_char_whitelist: VIN_OCR_WHITELIST,
      tessedit_char_blacklist: VIN_BLACKLIST,
      tessedit_pageseg_mode: psmLine,
      user_defined_dpi: "300",
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
    const vinParams = {
      tessedit_char_whitelist: VIN_OCR_WHITELIST,
      tessedit_char_blacklist: VIN_BLACKLIST,
    };
    await ocr.setParameters({ ...vinParams, tessedit_pageseg_mode: psmLine });
    const first = await ocr.recognize(canvas);
    const firstText = first.data.text ?? "";
    const firstClean = cleanOcrVinCandidate(firstText);
    if (firstClean.vin || !options?.retryBlock) {
      return {
        vin: firstClean.vin ?? extractVinFromOcr(firstText),
        confidence: first.data.confidence ?? 0,
        raw: firstClean.display || firstText.replace(/\s+/g, ""),
      };
    }
    await ocr.setParameters({ ...vinParams, tessedit_pageseg_mode: psmBlock });
    const second = await ocr.recognize(canvas);
    await ocr.setParameters({ ...vinParams, tessedit_pageseg_mode: psmLine });
    const secondText = second.data.text ?? "";
    const combined = cleanOcrVinCandidate(`${firstText}\n${secondText}`);
    const secondClean = cleanOcrVinCandidate(secondText);
    return {
      vin: secondClean.vin ?? combined.vin ?? extractVinFromOcr(secondText),
      confidence: Math.max(first.data.confidence ?? 0, second.data.confidence ?? 0),
      raw: secondClean.display || combined.display || secondText.replace(/\s+/g, ""),
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

function percentileStretch(gray: Float32Array, lowPct = 6, highPct = 90): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))] += 1;
  const n = gray.length;
  const loTarget = (n * lowPct) / 100;
  const hiTarget = (n * highPct) / 100;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  let loSet = false;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (!loSet && acc >= loTarget) {
      lo = v;
      loSet = true;
    }
    if (acc >= hiTarget) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < gray.length; i++) {
    let y = ((gray[i] - lo) / range) * 255;
    y = (y - 128) * 2.35 + 128;
    gray[i] = y < 0 ? 0 : y > 255 ? 255 : y;
  }
}

function median3(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(gray.length);
  const win = new Float32Array(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          win[n++] = gray[yy * w + xx];
        }
      }
      for (let i = 1; i < n; i++) {
        const val = win[i];
        let j = i - 1;
        while (j >= 0 && win[j] > val) {
          win[j + 1] = win[j];
          j -= 1;
        }
        win[j + 1] = val;
      }
      out[y * w + x] = win[(n - 1) >> 1];
    }
  }
  return out;
}

function dynamicThresholdDarkOnLight(gray: Float32Array, w: number, h: number, radius = 28, c = 16): Uint8ClampedArray {
  const integW = w + 1;
  const integ = new Float64Array(integW * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += gray[(y - 1) * w + (x - 1)];
      integ[y * integW + x] = integ[(y - 1) * integW + x] + row;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integ[(y1 + 1) * integW + (x1 + 1)] -
        integ[y0 * integW + (x1 + 1)] -
        integ[(y1 + 1) * integW + x0] +
        integ[y0 * integW + x0];
      const mean = sum / count;
      out[y * w + x] = gray[y * w + x] < mean - c ? 0 : 255;
    }
  }
  return out;
}

function morphOpen(bw: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const er = new Uint8ClampedArray(bw.length);
  const out = new Uint8ClampedArray(bw.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let keep = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (bw[yy * w + xx] === 0) keep += 1;
        }
      }
      er[y * w + x] = keep === 9 ? 0 : 255;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ink = false;
      for (let dy = -1; dy <= 1 && !ink; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (er[yy * w + xx] === 0) {
            ink = true;
            break;
          }
        }
      }
      out[y * w + x] = ink ? 0 : 255;
    }
  }
  return out;
}

/**
 * Dashboard VIN through glass: grayscale, crush windshield glare with a heavy
 * percentile stretch, median-filter dot-matrix speckle, then dynamic threshold
 * so only dark stamped characters remain on the light metal plate.
 */
export function enhanceDashboardStill(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { w, h } = sourceSize(source);
  if (!w || !h) return null;

  const cropW = Math.floor(w * 0.96);
  const cropH = Math.max(180, Math.floor(h * 0.42));
  const sx = Math.floor((w - cropW) / 2);
  const sy = Math.floor((h - cropH) / 2);
  const outW = Math.min(2560, cropW);
  const outH = Math.max(180, Math.round((cropH / cropW) * outW));
  canvas.width = outW;
  canvas.height = outH;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const img = ctx.getImageData(0, 0, outW, outH);
  const data = img.data;
  const gray = new Float32Array(outW * outH);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  percentileStretch(gray, 6, 90);
  const despeckled = median3(gray, outW, outH);
  const bw = morphOpen(dynamicThresholdDarkOnLight(despeckled, outW, outH), outW, outH);
  for (let p = 0, i = 0; p < bw.length; p++, i += 4) {
    data[i] = data[i + 1] = data[i + 2] = bw[p];
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
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

let audioCtx: AudioContext | null = null;

export function playVinLockSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx ?? new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.setValueAtTime(1310, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  } catch {
    /* autoplay or missing Web Audio */
  }
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
