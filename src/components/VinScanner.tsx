"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Keyboard, Zap } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import { extractVin, formatVin, isValidVin, normalizeVin, vinHint } from "@/lib/vin";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type DetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const VIN_FORMATS = ["code_39", "code_128", "qr_code"] as const;

const CAMERA_VIDEO: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

function vinQrbox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.max(240, Math.floor(viewfinderWidth * 0.94));
  const height = Math.max(72, Math.min(110, Math.floor(viewfinderHeight * 0.22)));
  return { width, height };
}

function enhanceStickerFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const cropW = Math.floor(vw * 0.94);
  const cropH = Math.max(80, Math.floor(vh * 0.24));
  const sx = Math.floor((vw - cropW) / 2);
  const sy = Math.floor((vh - cropH) / 2);
  canvas.width = cropW;
  canvas.height = cropH;
  ctx.filter = "contrast(1.55) grayscale(1) brightness(1.08)";
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  ctx.filter = "none";

  const img = ctx.getImageData(0, 0, cropW, cropH);
  const data = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = data[i];
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    let y = ((data[i] - min) / range) * 255;
    y = (y - 128) * 1.45 + 128;
    y = y < 48 ? 0 : y > 208 ? 255 : y;
    data[i] = data[i + 1] = data[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function openRearCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...CAMERA_VIDEO,
        advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
      },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: CAMERA_VIDEO });
  }
}

export function VinScanner({
  onVin,
  busy,
}: {
  onVin: (vin: string, source: "barcode" | "manual") => Promise<void> | void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5Ref = useRef<{ stop: () => Promise<void> } | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef<string>("");
  const pulseTimer = useRef<number | null>(null);
  const onVinRef = useRef(onVin);
  onVinRef.current = onVin;

  const [cameraOn, setCameraOn] = useState(false);
  const [engine, setEngine] = useState<"native" | "html5" | "off">("off");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [lockedVin, setLockedVin] = useState<string | null>(null);

  const flashLock = useCallback((vin: string) => {
    setTyped(vin);
    setLockedVin(vin);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setLockedVin(null), 1600);
    inputRef.current?.focus();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([25, 35, 45]);
  }, []);

  const handleRaw = useCallback(
    async (raw: string, source: "barcode" | "manual") => {
      const vin = extractVin(raw) ?? normalizeVin(raw);
      if (!isValidVin(vin)) return false;
      const repeat = source === "barcode" && lastRef.current === vin;
      flashLock(vin);
      if (repeat) return true;
      lastRef.current = vin;
      await onVinRef.current(vin, source);
      return true;
    },
    [flashLock],
  );

  const stopCamera = useCallback(async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (html5Ref.current) {
      try {
        await html5Ref.current.stop();
      } catch {
        /* already stopped */
      }
      html5Ref.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setEngine("off");
    setCameraOn(false);
  }, []);

  const startHtml5 = useCallback(async () => {
    if (!boxRef.current) return;
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    const id = "vinfuse-qr";
    boxRef.current.innerHTML = `<div id="${id}" class="overflow-hidden rounded-2xl"></div>`;
    const scanner = new Html5Qrcode(id, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      useBarCodeDetectorIfSupported: true,
    });
    await scanner.start(
      CAMERA_VIDEO,
      {
        fps: 15,
        qrbox: vinQrbox,
        aspectRatio: 16 / 9,
        disableFlip: true,
        videoConstraints: CAMERA_VIDEO,
      },
      (text) => {
        void handleRaw(text, "barcode");
      },
      () => undefined,
    );
    html5Ref.current = scanner;
    setEngine("html5");
    setCameraOn(true);
    setError(null);
  }, [handleRaw]);

  const startNative = useCallback(async () => {
    const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Detector) return false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return false;
    let detector: BarcodeDetectorLike;
    try {
      detector = new Detector({ formats: [...VIN_FORMATS] });
    } catch {
      return false;
    }
    const stream = await openRearCamera();
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
    timerRef.current = window.setInterval(async () => {
      if (video.readyState < 2) return;
      try {
        const enhanced = enhanceStickerFrame(video, canvas);
        const primary = enhanced ? await detector.detect(enhanced) : [];
        const codes = primary.length ? primary : await detector.detect(video);
        const raw = codes[0]?.rawValue;
        if (raw) await handleRaw(raw, "barcode");
      } catch {
        /* frame skipped */
      }
    }, 110);
    setEngine("native");
    setCameraOn(true);
    setError(null);
    return true;
  }, [handleRaw]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const native = await startNative();
      if (!native) await startHtml5();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera failed.";
      setError(message);
      setCameraOn(false);
    }
  }, [startHtml5, startNative]);

  useEffect(() => {
    void startCamera();
    return () => {
      void stopCamera();
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, [startCamera, stopCamera]);

  async function submitTyped() {
    const vin = normalizeVin(typed);
    const ok = await handleRaw(vin, "manual");
    if (!ok) setError(vinHint(vin) ?? "Invalid VIN.");
    else setError(null);
  }

  const locked = Boolean(lockedVin);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`relative overflow-hidden rounded-3xl border-4 bg-black transition-colors ${
          locked ? "border-ok shadow-[0_0_28px_rgba(52,211,153,0.55)]" : "border-white"
        }`}
      >
        <video
          ref={videoRef}
          className={`h-72 w-full object-cover ${engine === "html5" ? "hidden" : ""}`}
          playsInline
          muted
          autoPlay
        />
        <div ref={boxRef} className="[&_video]:h-72 [&_video]:w-full [&_video]:object-cover" />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`relative h-[4.75rem] w-[94%] rounded-md border-[3px] ${
              locked ? "border-ok bg-ok/10" : "border-cyan"
            } shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]`}
          >
            <span className="absolute -left-0.5 -top-0.5 h-4 w-4 border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-4 border-r-4 border-white" />
            <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-cyan/80" />
          </div>
        </div>

        <div className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
          {cameraOn ? "CODE 39 · 128 · QR" : "Camera off"}
        </div>

        {lockedVin ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border-2 border-ok bg-ok px-3 py-2 text-cyan-ink">
            <Check className="h-7 w-7 shrink-0" strokeWidth={3} />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]">VIN locked</p>
              <p className="truncate font-mono text-lg font-black tracking-wider">{formatVin(lockedVin)}</p>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-2xl border-2 border-alert bg-alert/10 px-3 py-2 text-sm font-bold text-alert">{error}</p>
      ) : (
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          Fill the white frame with the door-jamb or window-sticker barcode. High-contrast 1D scan — Code 39, Code 128,
          or QR only.
        </p>
      )}

      <Field
        label="Active scan"
        hint={lockedVin ? "Captured — logged to this Scan List." : vinHint(typed) ?? "17 characters. No I, O, or Q."}
      >
        <TextInput
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(normalizeVin(e.target.value).slice(0, 17))}
          placeholder="Waiting for VIN…"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className={
            locked
              ? "border-ok bg-ok/15 font-mono font-black tracking-wider text-ok"
              : "font-mono tracking-wider"
          }
        />
      </Field>
      {typed.length === 17 && !lockedVin ? (
        <p className="font-mono text-lg font-black tracking-wider text-cyan">{formatVin(typed)}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="line" onClick={() => (cameraOn ? stopCamera() : startCamera())}>
          <Camera className="h-5 w-5" />
          {cameraOn ? "Stop" : "Camera"}
        </Button>
        <Button variant="line" onClick={() => inputRef.current?.focus()}>
          <Keyboard className="h-5 w-5" />
          Type VIN
        </Button>
      </div>

      <Button onClick={submitTyped} disabled={busy || typed.length < 17}>
        <Zap className="h-5 w-5" />
        Log VIN
      </Button>
    </div>
  );
}
