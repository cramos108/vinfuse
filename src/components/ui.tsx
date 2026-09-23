"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export const inputClass =
  "min-h-14 w-full rounded-2xl border-2 border-line bg-navy-2 px-4 text-lg font-semibold text-white placeholder:text-muted/80 outline-none focus:border-cyan sunlight:bg-white sunlight:text-ink sunlight:border-slate-300 sunlight:placeholder:text-slate-400";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted sunlight:text-slate-600">{hint}</span> : null}
    </label>
  );
}

type BtnVariant = "cyan" | "ghost" | "line" | "alert" | "ok";

const variants: Record<BtnVariant, string> = {
  cyan: "bg-cyan text-cyan-ink border-cyan shadow-[0_0_24px_rgba(34,211,238,0.35)]",
  ghost: "bg-transparent text-white border-line sunlight:text-ink sunlight:border-slate-300",
  line: "bg-navy-3 text-white border-line sunlight:bg-white sunlight:text-ink sunlight:border-slate-300",
  alert: "bg-alert text-white border-alert",
  ok: "bg-ok text-cyan-ink border-ok",
};

export function Button({
  variant = "cyan",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-5 text-base font-extrabold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${inputClass} ${className}`} {...props} />;
  },
);

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border-2 border-line bg-navy-2 p-5 sunlight:border-slate-200 sunlight:bg-white sunlight:shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-2 border-line bg-navy p-5 sm:max-w-md sm:rounded-3xl sunlight:bg-white sunlight:border-slate-200"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="modal-title" className="text-2xl font-black leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border-2 border-line text-xl font-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: number | string;
  tone?: "cyan" | "ok" | "alert" | "warn";
}) {
  const tones = {
    cyan: "text-cyan",
    ok: "text-ok",
    alert: "text-alert",
    warn: "text-warn",
  };
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted sunlight:text-slate-500">
        {label}
      </span>
      <span className={`text-4xl font-black tabular-nums ${tones[tone]}`}>{value}</span>
    </Card>
  );
}
