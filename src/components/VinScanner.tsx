"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, Zap } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import { extractVin, formatVin, isValidVin, normalizeVin, vinHint } from "@/lib/vin";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

type DetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const FORMATS = ["code_39", "code_128", "codabar", "itf", "ean_13", "pdf417", "data_matrix", "qr_code"];

export function VinScanner({
  onVin,
  busy,
}: {
  onVin: (vin: string, source: "barcode" | "manual") => Promise<void> | void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5Ref = useRef<{ stop: () => Promise<void> } | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef<string>("");
  const onVinRef = useRef(onVin);
  onVinRef.current = onVin;
  const [cameraOn, setCameraOn] = useState(false);
  const [engine, setEngine] = useState<"native" | "html5" | "off">("off");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showType, setShowType] = useState(false);

  const handleRaw = useCallback(async (raw: string, source: "barcode" | "manual") => {
    const vin = extractVin(raw) ?? normalizeVin(raw);
    if (!isValidVin(vin)) return false;
    if (source === "barcode" && lastRef.current === vin) return true;
    lastRef.current = vin;
    await onVinRef.current(vin, source);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
    return true;
  }, []);

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
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
      ],
    });
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 8,
        qrbox: { width: 280, height: 140 },
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
    if (!video) return false;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
    const detector = new Detector({ formats: FORMATS });
    timerRef.current = window.setInterval(async () => {
      if (video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue;
        if (raw) await handleRaw(raw, "barcode");
      } catch {
        /* frame skipped */
      }
    }, 180);
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
      setShowType(true);
      setCameraOn(false);
    }
  }, [startHtml5, startNative]);

  useEffect(() => {
    void startCamera();
    return () => {
      void stopCamera();
    };
  }, [startCamera, stopCamera]);

  async function submitTyped() {
    const vin = normalizeVin(typed);
    const ok = await handleRaw(vin, "manual");
    if (!ok) setError(vinHint(vin) ?? "Invalid VIN.");
    else {
      setTyped("");
      setError(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl border-2 border-cyan bg-black">
        <video
          ref={videoRef}
          className={`h-64 w-full object-cover ${engine === "html5" ? "hidden" : ""}`}
          playsInline
          muted
          autoPlay
        />
        <div ref={boxRef} className="[&_video]:h-64 [&_video]:w-full [&_video]:object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-[86%] rounded-xl border-4 border-cyan/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-cyan">
          {cameraOn ? "Live camera" : "Camera off"}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border-2 border-alert bg-alert/10 px-3 py-2 text-sm font-bold text-alert">{error}</p>
      ) : (
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          Line up the VIN barcode on the dash, door jamb, or window sticker. Works in direct sun.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="line" onClick={() => (cameraOn ? stopCamera() : startCamera())}>
          <Camera className="h-5 w-5" />
          {cameraOn ? "Stop" : "Camera"}
        </Button>
        <Button variant="line" onClick={() => setShowType((v) => !v)}>
          <Keyboard className="h-5 w-5" />
          Type VIN
        </Button>
      </div>

      {showType ? (
        <div className="flex flex-col gap-3">
          <Field label="VIN" hint={vinHint(typed) ?? "17 characters. No I, O, or Q."}>
            <TextInput
              value={typed}
              onChange={(e) => setTyped(normalizeVin(e.target.value).slice(0, 17))}
              placeholder="1HGCM82633A004352"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </Field>
          {typed.length === 17 ? (
            <p className="font-mono text-lg font-black tracking-wider text-cyan">{formatVin(typed)}</p>
          ) : null}
          <Button onClick={submitTyped} disabled={busy || typed.length < 17}>
            <Zap className="h-5 w-5" />
            Log VIN
          </Button>
        </div>
      ) : null}
    </div>
  );
}
