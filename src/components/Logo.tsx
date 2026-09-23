import { APP_NAME } from "@/lib/brand";

export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="#020817" />
      <rect x="8" y="8" width="32" height="24" rx="6" fill="none" stroke="#22D3EE" strokeWidth="2.4" />
      <path
        d="M14 26c4-8 16-8 20 0"
        fill="none"
        stroke="#F8FAFC"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="26" r="2.2" fill="#14B8A6" />
      <circle cx="29.5" cy="26" r="2.2" fill="#14B8A6" />
      <rect x="14" y="36" width="2" height="6" fill="#22D3EE" />
      <rect x="18" y="34" width="2" height="8" fill="#14B8A6" />
      <rect x="22" y="37" width="2" height="5" fill="#22D3EE" />
      <rect x="26" y="34" width="2" height="8" fill="#F8FAFC" />
      <rect x="30" y="36" width="2" height="6" fill="#22D3EE" />
      <rect x="34" y="35" width="2" height="7" fill="#14B8A6" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark />
      {compact ? null : (
        <span className="text-xl font-black tracking-tight">
          Vin<span className="text-cyan">Fuse</span>
          <span className="sr-only">{APP_NAME}</span>
        </span>
      )}
    </span>
  );
}
