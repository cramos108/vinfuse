export const PRIVACY_HEADLINE = "Lot data stays on this device";

export const PRIVACY_BODY = [
  "VinFuse is built for general managers who do not want a third-party cloud holding their lot counts.",
  "Closed Walk Reports — timestamp, location name, and scanned VINs — are archived in this phone or tablet's browser storage (localStorage). That history never leaves the device unless you tap Share or Print.",
  "Live scanning in demo mode also stays in the browser. If your dealership connects its own Supabase project, only that project receives live team logins and open-session scans. Local walk archives still remain on this device.",
  "Clearing this browser's site data permanently deletes local walk history. VinFuse does not sell lot data or use it for advertising.",
] as const;

export const PRIVACY_SHORT =
  "Walk Reports are stored locally on this device. We do not upload closed lot audits to VinFuse servers.";
