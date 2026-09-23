# VinFuse

Mobile-first PWA for BHPH dealerships to walk the lot, scan VINs, and (on Pro) compare the **Scan List / Walk Report** against a **DMS Master List**.

Brand language matches [LeadFuse AI](https://bhph.leadfuse.ai/): navy surfaces, high contrast type, cyan/teal CTAs.

## Stack

- Next.js App Router (Vercel-ready)
- Supabase Auth + Postgres (optional — local demo works without it)
- PWA manifest + service worker (Add to Home Screen)

## Quick start

```bash
cd VinFuse
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase env vars the app runs in **local demo mode** (data in this browser).

- Sign in → **Try the Suncoast demo lot**
- Demo login: `demo@vinfuse.app` / `demo1234`
- Free: unlimited camera/manual VIN scans, one location, Scan List / Walk Report
- Upgrade in-app to Pro ($19.99/mo gates): DMS Master Baseline for the current audit (does not delete scan history), 2 sales lots + 1 service center, printable discrepancy report, team invites

## Supabase (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Auth → enable Email. Turn off “Confirm email” while testing, or handle the confirmation message in the UI.

Signup as a manager creates a dealership + Main Lot. Porters join with a 6-character invite code from **Team**.

## Feature gates

| | Free | Pro ($19.99/mo) |
|---|---|---|
| Camera VIN / barcode scan | Unlimited | Unlimited |
| Locations | 1 | 2 sales lots + 1 service center |
| Scan List / Walk Report | Yes | Yes |
| DMS Master Baseline (current audit comparison) | No | Yes |
| Missing / unmatched / misplaced report + print/PDF | No | Yes |
| Team logins | No | Managers + lot porters |

## Deploy on Vercel

Push this folder (or the repo) and set the two `NEXT_PUBLIC_SUPABASE_*` env vars. Manifest: `/manifest.json`. Service worker: `/sw.js`.

Sunlight mode (sun icon in the header) flips the app to a white, max-contrast outdoor theme.
