import Link from "next/link";
import { Check, ScanLine, MapPin, FileSpreadsheet, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { APP_NAME, ECOSYSTEM, ECOSYSTEM_URL, PRO_PRICE_LABEL } from "@/lib/brand";
import { PLANS } from "@/lib/plan";

const FEATURES = [
  {
    icon: ScanLine,
    title: "Sunlight-ready VIN scanner",
    body: "Large, high-contrast controls. Camera barcode + typed VIN fallback for every unit on the lot.",
  },
  {
    icon: MapPin,
    title: "Multi-location audits",
    body: "Pro unlocks two sales lots and a service center so porters scan the right yard.",
  },
  {
    icon: FileSpreadsheet,
    title: "DMS Master List vs Walk Report",
    body: "Upload a book baseline for this audit, then compare it to the Scan List from the lot walk. Missing, unmatched, and misplaced — printable for month-end.",
  },
  {
    icon: Users,
    title: "Managers and lot porters",
    body: "Multi-tenant by dealership. Admins run reports. Attendants just scan and go.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden min-h-11 items-center px-3 text-sm font-extrabold uppercase tracking-wide sm:inline-flex">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center rounded-xl bg-cyan px-4 text-sm font-extrabold uppercase tracking-wide text-cyan-ink"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#22d3ee33,transparent_45%)]" />
          <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-teal">
                Built for independent BHPH dealers
              </p>
              <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                Stop guessing the lot.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal to-cyan">
                  Start knowing every VIN.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg font-medium text-slate-600">
                {APP_NAME} is the physical inventory audit app for Buy Here Pay Here lots. Scan barcodes in the sun,
                build a Scan List on the walk, and (on Pro) compare it to your DMS Master List in minutes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-cyan px-6 text-base font-extrabold uppercase tracking-wide text-cyan-ink shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                >
                  Start scanning free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-slate-300 px-6 text-base font-extrabold uppercase tracking-wide"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                Unlimited VIN scans on Free. No credit card. Add to your home screen.
              </p>
            </div>
            <div className="rounded-[2rem] border-2 border-slate-200 bg-navy p-5 text-white shadow-2xl">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan">Live audit · Main Lot</p>
              <p className="mt-3 font-mono text-3xl font-black tracking-wider text-cyan">1HG CM8263 3A004352</p>
              <p className="mt-1 text-sm font-bold text-slate-300">Honda Accord · logged just now</p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  ["Scanned", "47"],
                  ["Missing", "6"],
                  ["Misplaced", "2"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-line bg-navy-2 p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{label}</p>
                    <p className="text-2xl font-black text-cyan">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">The engine for lot walks</h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Built in the {ECOSYSTEM} ecosystem — the same high-contrast, high-conversion look your dealers already
              trust.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-slate-200 bg-paper p-5">
                  <feature.icon className="h-8 w-8 text-cyan" />
                  <h3 className="mt-3 text-xl font-black">{feature.title}</h3>
                  <p className="mt-2 font-medium text-slate-600">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-3xl font-black tracking-tight">Simple pricing. Built for BHPH.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <PlanCard
                name={PLANS.free.name}
                price={PLANS.free.priceLabel}
                features={[...PLANS.free.features]}
                locked={[...PLANS.free.locked]}
                href="/signup"
                cta="Continue free"
                featured={false}
              />
              <PlanCard
                name={PLANS.pro.name}
                price={PLANS.pro.priceLabel}
                features={[...PLANS.pro.features]}
                locked={[]}
                href="/signup"
                cta={`Go Pro · ${PRO_PRICE_LABEL}`}
                featured
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. A {ECOSYSTEM} product for independent BHPH dealers.
          </p>
          <a href={ECOSYSTEM_URL} className="text-cyan-ink underline decoration-cyan">
            {ECOSYSTEM} AI
          </a>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  locked,
  href,
  cta,
  featured,
}: {
  name: string;
  price: string;
  features: string[];
  locked: string[];
  href: string;
  cta: string;
  featured: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-3xl border-2 p-6 ${
        featured ? "border-cyan bg-navy text-white shadow-[0_0_32px_rgba(34,211,238,0.2)]" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan">{name}</p>
      <p className="mt-2 text-4xl font-black">{price}</p>
      <ul className="mt-6 flex flex-col gap-2 text-sm font-semibold">
        {features.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
            {item}
          </li>
        ))}
        {locked.map((item) => (
          <li key={item} className="flex gap-2 text-slate-400 line-through">
            <span className="mt-0.5 h-4 w-4 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl px-5 text-sm font-extrabold uppercase tracking-wide ${
          featured ? "bg-cyan text-cyan-ink" : "border-2 border-slate-300"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
