import Link from "next/link";
import { Logo } from "@/components/Logo";
import { APP_NAME } from "@/lib/brand";
import { PRIVACY_BODY, PRIVACY_HEADLINE } from "@/lib/privacy";

export const metadata = {
  title: `Security & Privacy · ${APP_NAME}`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo />
          <Link href="/" className="text-sm font-extrabold uppercase tracking-wide">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-teal">For general managers</p>
        <h1 className="text-4xl font-black tracking-tight">{PRIVACY_HEADLINE}</h1>
        {PRIVACY_BODY.map((p) => (
          <p key={p} className="text-lg font-medium leading-relaxed text-slate-600">
            {p}
          </p>
        ))}
        <Link href="/signup" className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl bg-cyan px-6 text-sm font-extrabold uppercase tracking-wide text-cyan-ink">
          Start scanning on this device
        </Link>
      </main>
    </div>
  );
}
