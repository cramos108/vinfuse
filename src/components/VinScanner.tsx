"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Flashlight, FlashlightOff, Keyboard, ScanLine, Type, Zap } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import type { ScanSource } from "@/lib/types";
import {
  extractVin,
  firstValidVin,
  formatVin,
  isValidVin,
  normalizeVin,
  vinHint,
} from "@/lib/vin";
import {
  createVinBarcodeDetector,
  detectVinBarcodes,
  hasBarcodeDetector,
} from "@/lib/barcodeNative";
import {
  CLOSEUP_CAMERA,
  CLOSEUP_CAMERA_FLEX,
  CLOSEUP_CAMERA_OCR,
  capabilitiesHaveTorch,
  openRearCamera,
  setTrackTorch,
  trackHasTorch,
} from "@/lib/camera";
import {
  captureHighResStill,
  enhanceDashboardStill,
  getVinOcrWorker,
  playVinLockSound,
  preprocessVinSnapshot,
  recognizeVinFromCanvas,
  terminateVinOcr,
} from "@/lib/vinOcr";

type ScanMode = "barcode" | "ocr";

function vinQrbox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.max(240, Math.floor(viewfinderWidth * 0.94));
  const height = Math.max(72, Math.min(110, Math.floor(viewfinderHeight * 0.22)));
  return { width, height };
}

export function VinScanner({
  onVin,
  busy,
}: {
  onVin: (vin: string, source: ScanSource) => Promise<void> | void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5Ref = useRef<{
    stop: () => Promise<void>;
    applyVideoConstraints?: (constraints: MediaTrackConstraints) => Promise<void>;
    getRunningTrackCapabilities?: () => MediaTrackCapabilities;
  } | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef<string>("");
  const pulseTimer = useRef<number | null>(null);
  const modeRef = useRef<ScanMode>("barcode");
  const onVinRef = useRef(onVin);
  onVinRef.current = onVin;

  const [mode, setMode] = useState<ScanMode>("barcode");
  const [cameraOn, setCameraOn] = useState(false);
  const [engine, setEngine] = useState<"native" | "html5" | "ocr" | "off">("off");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [lockedVin, setLockedVin] = useState<string | null>(null);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrHint, setOcrHint] = useState(
    "Aim through the windshield at the dashboard VIN plate, then tap Capture Dashboard VIN.",
  );
  const [ocrBusy, setOcrBusy] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  modeRef.current = mode;

  const flashLock = useCallback((vin: string) => {
    setTyped(vin);
    setLockedVin(vin);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setLockedVin(null), 1600);
    inputRef.current?.focus();
    playVinLockSound();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([25, 35, 45]);
  }, []);

  const handleRaw = useCallback(
    async (raw: string, source: ScanSource) => {
      const vin = extractVin(raw) ?? normalizeVin(raw);
      if (!isValidVin(vin)) return false;
      const repeat = source !== "manual" && lastRef.current === vin;
      flashLock(vin);
      if (repeat) return true;
      lastRef.current = vin;
      await onVinRef.current(vin, source);
      return true;
    },
    [flashLock],
  );

  const captureDashboardVin = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!video || !canvas || !stream) return;
    setOcrBusy(true);
    setError(null);
    setOcrHint("Capturing high-resolution dashboard still…");
    try {
      const still = await captureHighResStill(stream, video);
      setOcrHint("Enhancing still — contrast, edges, black-and-white…");
      const enhanced = enhanceDashboardStill(still, canvas);
      if (!enhanced) {
        setOcrHint("Could not process that still. Hold over the plate and capture again.");
        return;
      }
      setOcrHint("Reading VIN from enhanced snapshot…");
      const result = await recognizeVinFromCanvas(enhanced, { wait: true, retryBlock: true });
      if (modeRef.current !== "ocr") return;
      const vin = firstValidVin(result.raw) ?? result.vin;
      if (!vin || !isValidVin(vin)) {
        setOcrHint("No 17-character VIN in that capture. Fill the frame with the dash plate and try again.");
        return;
      }
      setOcrHint("VIN locked — logged to this Walk Scan List.");
      await handleRaw(vin, "ocr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard VIN capture failed.");
    } finally {
      setOcrBusy(false);
    }
  }, [handleRaw]);

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
    if (boxRef.current) boxRef.current.innerHTML = "";
    setEngine("off");
    setCameraOn(false);
    setTorchOn(false);
    setTorchAvailable(false);
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
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      useBarCodeDetectorIfSupported: true,
    });
    await scanner.start(
      CLOSEUP_CAMERA_FLEX,
      {
        fps: 15,
        qrbox: vinQrbox,
        aspectRatio: 16 / 9,
        disableFlip: true,
        videoConstraints: CLOSEUP_CAMERA_FLEX,
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
    setTorchOn(false);
    try {
      setTorchAvailable(capabilitiesHaveTorch(scanner.getRunningTrackCapabilities()));
    } catch {
      setTorchAvailable(false);
    }
  }, [handleRaw]);

  const startNative = useCallback(async () => {
    if (!("BarcodeDetector" in window) || !hasBarcodeDetector()) return false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return false;
    const detector = await createVinBarcodeDetector();
    if (!detector) return false;
    const stream = await openRearCamera(CLOSEUP_CAMERA);
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
    let scanning = false;
    timerRef.current = window.setInterval(async () => {
      if (scanning || video.readyState < 2) return;
      scanning = true;
      try {
        let codes = await detectVinBarcodes(detector, video);
        if (!codes.length) {
          const enhanced = preprocessVinSnapshot(video, canvas, "barcode");
          if (enhanced) codes = await detectVinBarcodes(detector, enhanced);
        }
        const raw = codes[0]?.rawValue;
        if (raw) await handleRaw(raw, "barcode");
      } catch {
        /* frame skipped */
      } finally {
        scanning = false;
      }
    }, 80);
    setEngine("native");
    setCameraOn(true);
    setError(null);
    setTorchOn(false);
    setTorchAvailable(trackHasTorch(stream.getVideoTracks()[0]));
    return true;
  }, [handleRaw]);

  const startOcr = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setOcrHint("Loading dashboard VIN reader…");
    setOcrReady(false);
    await getVinOcrWorker();
    setOcrReady(true);
    const stream = await openRearCamera(CLOSEUP_CAMERA_OCR);
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
    setEngine("ocr");
    setCameraOn(true);
    setError(null);
    setOcrHint("Aim through the windshield at the dashboard VIN plate, then tap Capture Dashboard VIN.");
    setTorchOn(false);
    setTorchAvailable(trackHasTorch(stream.getVideoTracks()[0]));
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (modeRef.current === "ocr") {
        await startOcr();
        return;
      }
      const native = await startNative();
      if (!native) await startHtml5();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera failed.";
      setError(message);
      setCameraOn(false);
    }
  }, [startHtml5, startNative, startOcr]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await stopCamera();
      if (cancelled) return;
      await startCamera();
    })();
    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [mode, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      void terminateVinOcr();
    };
  }, []);

  async function changeMode(next: ScanMode) {
    if (next === mode) return;
    setMode(next);
  }

  async function submitTyped() {
    const vin = normalizeVin(typed);
    const ok = await handleRaw(vin, "manual");
    if (!ok) setError(vinHint(vin) ?? "Invalid VIN.");
    else setError(null);
  }

  async function toggleTorch() {
    const next = !torchOn;
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && trackHasTorch(track)) {
      const ok = await setTrackTorch(track, next);
      if (ok) {
        setTorchOn(next);
        setError(null);
        return;
      }
    }
    const html5 = html5Ref.current;
    if (html5?.applyVideoConstraints) {
      try {
        await html5.applyVideoConstraints({
          advanced: [{ torch: next }],
        } as unknown as MediaTrackConstraints);
        setTorchOn(next);
        setError(null);
        return;
      } catch {
        /* fall through */
      }
    }
    setTorchAvailable(false);
    setError("This camera has no flashlight. Use the phone's system torch if available.");
  }

  const locked = Boolean(lockedVin);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void changeMode("barcode")}
          className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-3 text-sm font-extrabold uppercase tracking-wide ${
            mode === "barcode" ? "border-cyan bg-cyan text-cyan-ink" : "border-line"
          }`}
        >
          <ScanLine className="h-5 w-5" />
          Barcode
        </button>
        <button
          type="button"
          onClick={() => void changeMode("ocr")}
          className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-3 text-sm font-extrabold uppercase tracking-wide ${
            mode === "ocr" ? "border-cyan bg-cyan text-cyan-ink" : "border-line"
          }`}
        >
          <Type className="h-5 w-5" />
          Dashboard VIN
        </button>
      </div>

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
            className={`relative rounded-md border-[3px] ${
              locked ? "border-ok bg-ok/10" : "border-cyan"
            } shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] ${
              mode === "ocr" ? "h-32 w-[96%]" : "h-[4.75rem] w-[94%]"
            }`}
          >
            <span className="absolute -left-0.5 -top-0.5 h-4 w-4 border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-4 border-r-4 border-white" />
            <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-cyan/80" />
          </div>
        </div>

        <div className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
          {!cameraOn
            ? "Camera off"
            : mode === "ocr"
              ? ocrReady
                ? ocrBusy
                  ? "OCR reading…"
                  : "Dashboard VIN"
                : "OCR loading…"
              : engine === "native"
                ? "Native 39 · 128 · DM · QR"
                : "CODE 39 · 128 · DM · QR"}
        </div>

        {cameraOn ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torchOn}
            aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            title={
              torchOn
                ? "Flashlight on"
                : torchAvailable
                  ? "Flashlight — cut shadows and laminate glare"
                  : "Flashlight (if this camera has a torch)"
            }
            className={`absolute right-3 top-3 z-10 grid h-14 w-14 place-items-center rounded-2xl border-2 ${
              torchOn
                ? "border-warn bg-warn text-navy"
                : "border-white bg-black/80 text-white"
            } disabled:opacity-40`}
          >
            {torchOn ? <Flashlight className="h-7 w-7" /> : <FlashlightOff className="h-7 w-7" />}
          </button>
        ) : null}

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
          {mode === "ocr"
            ? ocrHint
            : "Fill the frame with the door-jamb or window-sticker barcode (Code 39, Code 128, Data Matrix, or QR). Use the flashlight for shadows and laminate glare."}
        </p>
      )}

      <Field
        label="Active scan"
        hint={
          lockedVin
            ? "Captured — logged to this Scan List."
            : vinHint(typed) ?? "17 characters. No I, O, or Q."
        }
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

      {mode === "ocr" ? (
        <Button
          className="w-full min-h-16 text-base"
          onClick={() => void captureDashboardVin()}
          disabled={!cameraOn || ocrBusy || busy}
        >
          <Camera className="h-6 w-6" />
          {ocrBusy ? "Capturing…" : "Capture Dashboard VIN"}
        </Button>
      ) : null}

      <Button onClick={submitTyped} disabled={busy || typed.length < 17}>
        <Zap className="h-5 w-5" />
        Log VIN
      </Button>
    </div>
  );
}
