"use client";

type TorchCaps = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
};

const TORCH_ON = { advanced: [{ torch: true }] } as unknown as MediaTrackConstraints;
const TORCH_OFF = { advanced: [{ torch: false }] } as unknown as MediaTrackConstraints;

/** Close-up lot stickers: rear camera, high-res, 30fps. Autofocus applied after the stream starts. */
export const CLOSEUP_CAMERA: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { min: 1280, ideal: 1920 },
  height: { min: 720, ideal: 1080 },
  frameRate: { ideal: 30 },
};

export const CLOSEUP_CAMERA_OCR: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { min: 1280, ideal: 3840 },
  height: { min: 720, ideal: 2160 },
  frameRate: { ideal: 30 },
};

/** Ideal-only constraints for engines that reject `min` width/height. */
export const CLOSEUP_CAMERA_FLEX: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
};

export async function openRearCamera(constraints: MediaTrackConstraints): Promise<MediaStream> {
  const withFocus = {
    ...constraints,
    advanced: [{ focusMode: "continuous" }],
  } as unknown as MediaTrackConstraints;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: withFocus });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraints });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
    }
  }
  const track = stream.getVideoTracks()[0];
  if (track) await applyContinuousAutofocus(track);
  return stream;
}

export async function applyContinuousAutofocus(track: MediaStreamTrack): Promise<void> {
  const caps = track.getCapabilities?.() as TorchCaps | undefined;
  const modes = caps?.focusMode ?? [];
  if (modes.length && !modes.includes("continuous")) return;
  try {
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints);
  } catch {
    try {
      await track.applyConstraints({
        focusMode: "continuous",
      } as unknown as MediaTrackConstraints);
    } catch {
      /* device has no continuous AF */
    }
  }
}

export function trackHasTorch(track: MediaStreamTrack | null | undefined): boolean {
  if (!track) return false;
  try {
    const caps = track.getCapabilities() as TorchCaps;
    return Boolean(caps.torch);
  } catch {
    return false;
  }
}

export function capabilitiesHaveTorch(caps: MediaTrackCapabilities | null | undefined): boolean {
  return Boolean((caps as TorchCaps | undefined)?.torch);
}

export async function setTrackTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints(on ? TORCH_ON : TORCH_OFF);
    return true;
  } catch {
    return false;
  }
}
