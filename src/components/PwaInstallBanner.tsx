"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";

const DISMISS_KEY = "vinfuse.pwa_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function PwaInstallBanner() {
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setShowIos(isIosSafari());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setAndroidPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private */
    }
    setAndroidPrompt(null);
    setShowIos(false);
    setIosHelp(false);
  }

  async function install() {
    if (!androidPrompt) return;
    await androidPrompt.prompt();
    dismiss();
  }

  if (isStandalone() || (!androidPrompt && !showIos)) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-[4.75rem] z-20 mx-auto w-full max-w-lg px-4">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-cyan bg-navy-2 p-3 sunlight:bg-white">
          <Smartphone className="h-7 w-7 shrink-0 text-cyan" />
          <p className="flex-1 text-sm font-bold leading-snug">Add VinFuse to your home screen for one-tap lot audits.</p>
          <Button
            className="min-h-11 shrink-0 px-3 text-xs"
            onClick={androidPrompt ? install : () => setIosHelp(true)}
          >
            Install
          </Button>
          <button type="button" aria-label="Dismiss" onClick={dismiss} className="grid h-10 w-10 place-items-center">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <Modal open={iosHelp} title="Add to Home Screen" onClose={() => setIosHelp(false)}>
        <ol className="flex flex-col gap-3 text-base font-semibold">
          <li className="flex gap-2">
            <Share className="mt-0.5 h-5 w-5 text-cyan" />
            Tap the Share button in Safari.
          </li>
          <li>Scroll and tap Add to Home Screen.</li>
          <li>Open VinFuse from your home screen like a native app.</li>
        </ol>
      </Modal>
    </>
  );
}
