"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, ScanLine, Settings, Sun, Moon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { isManager, isPro, planLabel } from "@/lib/plan";

const NAV = [
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/log", label: "Walk", icon: ClipboardList },
  { href: "/audit", label: "Audit", icon: LayoutDashboard, manager: true },
  { href: "/settings", label: "More", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading, sunlight, toggleSunlight } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-navy text-white">
        <p className="text-lg font-bold text-cyan">Loading VinFuse…</p>
      </div>
    );
  }

  if (!session) return <>{children}</>;

  const items = NAV.filter(
    (item) => !item.manager || isManager(session.user.role) || isPro(session.dealership),
  );

  return (
    <div className="min-h-dvh bg-navy text-white sunlight:bg-paper sunlight:text-ink">
      <header className="sticky top-0 z-30 border-b-2 border-line bg-navy/95 px-4 py-3 backdrop-blur print:hidden sunlight:border-slate-200 sunlight:bg-white/95">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="rounded-full border-2 border-cyan px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan">
              {session.kind === "local" && !isPro(session.dealership)
                ? "Device"
                : planLabel(session.dealership.plan)}
            </span>
            <button
              type="button"
              onClick={toggleSunlight}
              className="grid h-11 w-11 place-items-center rounded-xl border-2 border-line"
              aria-label={sunlight ? "Switch to dark lot mode" : "Switch to sunlight mode"}
            >
              {sunlight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-warn" />}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-4 print:max-w-none print:p-0">{children}</main>
      <div className="print:hidden">
        <PwaInstallBanner />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-navy/95 pb-[env(safe-area-inset-bottom)] print:hidden sunlight:border-slate-200 sunlight:bg-white/95">
        <div className={`mx-auto grid max-w-lg ${items.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const locked = item.href === "/audit" && !isPro(session.dealership);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold uppercase tracking-wide ${
                  active ? "text-cyan" : "text-muted sunlight:text-slate-500"
                }`}
              >
                <Icon className="h-6 w-6" />
                {item.label}
                {locked ? <span className="sr-only">Pro</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
