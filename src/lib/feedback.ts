"use client";

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
