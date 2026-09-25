"use client";

import { parseInventoryCsv } from "./csv";
import { clearAllWalkHistory } from "./walkHistory";
import { canAddLocation, canImportCsv, canInviteTeam, isPro, uniqueVinCount, vinCapReached } from "./plan";
import { reconcileInventory } from "./reconcile";
import { getSupabase, supabaseConfigured } from "./supabase";
import type {
  AuditSession,
  AuthSession,
  Dealership,
  InventoryItem,
  Invite,
  Location,
  LocationKind,
  Plan,
  Profile,
  ReconcileResult,
  Role,
  Scan,
  ScanSource,
} from "./types";
import { extractVin, isValidVin, normalizeVin } from "./vin";

const DB_KEY = "vinfuse.v1";
const SUN_KEY = "vinfuse.sunlight";
const LOC_KEY = "vinfuse.activeLocation";
const DEMO_EMAIL = "demo@vinfuse.app";
const DEMO_PASSWORD = "demo1234";
const DEVICE_EMAIL = "device@local.vinfuse";

type LocalDb = {
  dealerships: Dealership[];
  locations: Location[];
  profiles: Profile[];
  passwords: Record<string, string>;
  auditSessions: AuditSession[];
  scans: Scan[];
  inventory: InventoryItem[];
  invites: Invite[];
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function emptyDb(): LocalDb {
  return {
    dealerships: [],
    locations: [],
    profiles: [],
    passwords: {},
    auditSessions: [],
    scans: [],
    inventory: [],
    invites: [],
  };
}

function loadDb(): LocalDb {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...(JSON.parse(raw) as LocalDb) };
  } catch {
    return emptyDb();
  }
}

function saveDb(db: LocalDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  emit();
}

export function isSunlight(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SUN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSunlight(on: boolean) {
  localStorage.setItem(SUN_KEY, on ? "1" : "0");
  document.documentElement.classList.toggle("sunlight", on);
  emit();
}

export function bootSunlight() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("sunlight", isSunlight());
}

function readActiveLocationId(): string | null {
  try {
    return localStorage.getItem(LOC_KEY);
  } catch {
    return null;
  }
}

function writeActiveLocationId(id: string) {
  localStorage.setItem(LOC_KEY, id);
  emit();
}

const USER_KEY = "vinfuse.user";

function currentUserId(): string | null {
  try {
    return sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function setCurrentUserId(id: string | null) {
  try {
    if (id) {
      sessionStorage.setItem(USER_KEY, id);
      localStorage.setItem(USER_KEY, id);
    } else {
      sessionStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* private mode */
  }
}

function sessionFromDb(db: LocalDb, userId: string): AuthSession | null {
  const user = db.profiles.find((p) => p.id === userId);
  if (!user) return null;
  const dealership = db.dealerships.find((d) => d.id === user.dealershipId);
  if (!dealership) return null;
  return { user, dealership, kind: "local" };
}

export function getLocalSession(): AuthSession | null {
  const id = currentUserId();
  if (!id) return null;
  return sessionFromDb(loadDb(), id);
}

export function ensureLocalWorkspace(): AuthSession {
  const existing = getLocalSession();
  if (existing) return existing;
  const db = loadDb();
  let profile = db.profiles.find((p) => p.email === DEVICE_EMAIL);
  if (!profile) {
    const dealer: Dealership = {
      id: uid(),
      name: "This device",
      plan: "free",
      createdAt: now(),
    };
    const location: Location = {
      id: uid(),
      dealershipId: dealer.id,
      name: "Main Lot",
      kind: "sales_lot",
    };
    profile = {
      id: uid(),
      dealershipId: dealer.id,
      email: DEVICE_EMAIL,
      fullName: "Lot porter",
      role: "porter",
    };
    db.dealerships.push(dealer);
    db.locations.push(location);
    db.profiles.push(profile);
    db.passwords[profile.id] = "lot";
    writeActiveLocationId(location.id);
    saveDb(db);
  } else {
    setCurrentUserId(profile.id);
  }
  setCurrentUserId(profile.id);
  const session = sessionFromDb(loadDb(), profile.id);
  if (!session) throw new Error("Could not open the on-device workspace.");
  emit();
  return session;
}

export async function getSession(): Promise<AuthSession | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getUser();
    if (data.user) {
      const { data: profile } = await sb
        .from("profiles")
        .select("id, dealership_id, email, full_name, role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) {
        const { data: dealer } = await sb
          .from("dealerships")
          .select("id, name, plan, created_at")
          .eq("id", profile.dealership_id)
          .maybeSingle();
        if (dealer) {
          return {
            user: {
              id: profile.id,
              dealershipId: profile.dealership_id,
              email: profile.email,
              fullName: profile.full_name,
              role: profile.role,
            },
            dealership: {
              id: dealer.id,
              name: dealer.name,
              plan: dealer.plan as Dealership["plan"],
              createdAt: dealer.created_at,
            },
            kind: "cloud",
          };
        }
      }
      return null;
    }
  }
  if (typeof window === "undefined") return null;
  return ensureLocalWorkspace();
}

async function cloudClient() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? sb : null;
}

async function waitForCloudSession(attempts = 12): Promise<AuthSession | null> {
  for (let i = 0; i < attempts; i++) {
    const next = await getSession();
    if (next?.kind === "cloud") return next;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const session = (await waitForCloudSession()) ?? (await getSession());
    if (!session || session.kind !== "cloud") {
      throw new Error("Signed in, but no dealership workspace was found. Confirm the account email and try again.");
    }
    emit();
    return session;
  }
  const db = loadDb();
  const user = db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || db.passwords[user.id] !== password) {
    throw new Error("Invalid email or password.");
  }
  setCurrentUserId(user.id);
  const session = sessionFromDb(db, user.id);
  if (!session) throw new Error("Account is missing a dealership.");
  emit();
  return session;
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  setCurrentUserId(null);
  if (typeof window !== "undefined") ensureLocalWorkspace();
  else emit();
}

export async function requestPasswordReset(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Password reset is available for dealership manager accounts.");
  const trimmed = email.trim();
  if (!trimmed) throw new Error("Enter the manager email.");
  const { error } = await sb.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Password reset is available for dealership manager accounts.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export function wipeLocalWalkData(dealershipId: string) {
  clearAllWalkHistory();
  const db = loadDb();
  db.scans = db.scans.filter((s) => s.dealershipId !== dealershipId);
  db.auditSessions = db.auditSessions.filter((s) => s.dealershipId !== dealershipId);
  saveDb(db);
}

type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  dealershipName: string;
  inviteCode?: string;
};

export type LocalAccount = {
  id: string;
  fullName: string;
  email: string;
  dealershipName: string;
  role: Role;
};

export function listLocalAccounts(): LocalAccount[] {
  if (supabaseConfigured) return [];
  const db = loadDb();
  return db.profiles.map((profile) => ({
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    dealershipName: db.dealerships.find((d) => d.id === profile.dealershipId)?.name ?? "Lot",
    role: profile.role,
  }));
}

export async function continueLocal(profileId: string): Promise<AuthSession> {
  const db = loadDb();
  const session = sessionFromDb(db, profileId);
  if (!session) throw new Error("That lot is not on this device.");
  setCurrentUserId(profileId);
  emit();
  return session;
}

function slugId(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
  return slug || "lot";
}

export async function signUp(input: SignUpInput): Promise<AuthSession> {
  const fullName = input.fullName.trim();
  const inviteCode = input.inviteCode?.trim().toUpperCase();
  let dealershipName = input.dealershipName.trim();
  const sb = getSupabase();
  if (!fullName) throw new Error("Enter your name.");
  if (sb) {
    if (!input.email.trim() || !input.password) {
      throw new Error("Email and password are required for a dealership workspace.");
    }
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");
  }
  const email =
    input.email.trim().toLowerCase() || `${slugId(fullName)}.${Date.now().toString(36)}@local.vinfuse`;
  const password = input.password || "lot";
  if (!inviteCode && !dealershipName) dealershipName = `${fullName}'s lot`;

  if (sb) {
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          dealership_name: dealershipName || "My Dealership",
          invite_code: inviteCode || "",
        },
      },
    });
    if (error) throw new Error(error.message);
    const session = (await waitForCloudSession()) ?? (await getSession());
    if (!session || session.kind !== "cloud") {
      throw new Error("Check your email to confirm the dealership workspace, then sign in.");
    }
    emit();
    return session;
  }

  const db = loadDb();
  if (db.profiles.some((p) => p.email === email)) throw new Error("That email is already in use.");

  if (inviteCode) {
    const invite = db.invites.find((i) => i.code === inviteCode && !i.usedAt);
    if (!invite) throw new Error("Invite code is invalid or already used.");
    const profile: Profile = {
      id: uid(),
      dealershipId: invite.dealershipId,
      email,
      fullName,
      role: invite.role,
    };
    invite.usedAt = now();
    db.profiles.push(profile);
    db.passwords[profile.id] = password;
    setCurrentUserId(profile.id);
    saveDb(db);
    const session = sessionFromDb(db, profile.id);
    if (!session) throw new Error("Invite dealership is missing.");
    return session;
  }

  if (!dealershipName) throw new Error("Enter your dealership name.");
  const dealer: Dealership = {
    id: uid(),
    name: dealershipName,
    plan: "free",
    createdAt: now(),
  };
  const location: Location = {
    id: uid(),
    dealershipId: dealer.id,
    name: "Main Lot",
    kind: "sales_lot",
  };
  const profile: Profile = {
    id: uid(),
    dealershipId: dealer.id,
    email,
    fullName,
    role: "manager",
  };
  db.dealerships.push(dealer);
  db.locations.push(location);
  db.profiles.push(profile);
  db.passwords[profile.id] = password;
  setCurrentUserId(profile.id);
  writeActiveLocationId(location.id);
  saveDb(db);
  return sessionFromDb(db, profile.id)!;
}

function seedDemo(db: LocalDb): Profile {
  const existing = db.profiles.find((p) => p.email === DEMO_EMAIL);
  if (existing) return existing;

  const dealer: Dealership = {
    id: uid(),
    name: "Suncoast Auto BHPH",
    plan: "free",
    createdAt: now(),
  };
  const main: Location = {
    id: uid(),
    dealershipId: dealer.id,
    name: "Main Lot",
    kind: "sales_lot",
  };
  const north: Location = {
    id: uid(),
    dealershipId: dealer.id,
    name: "North Lot",
    kind: "sales_lot",
  };
  const service: Location = {
    id: uid(),
    dealershipId: dealer.id,
    name: "Service Center",
    kind: "service_center",
  };
  const manager: Profile = {
    id: uid(),
    dealershipId: dealer.id,
    email: DEMO_EMAIL,
    fullName: "Alex Rivera",
    role: "manager",
  };
  const porter: Profile = {
    id: uid(),
    dealershipId: dealer.id,
    email: "porter@vinfuse.app",
    fullName: "Jordan Cole",
    role: "porter",
  };

  const cars: Array<[string, string, string, string, string, string, Location]> = [
    ["1HGCM82633A004352", "A352", "2018", "Honda", "Accord", "Silver", main],
    ["2T1BURHE0JC074221", "B221", "2018", "Toyota", "Corolla", "White", main],
    ["1N4AL3AP8JC123456", "C456", "2017", "Nissan", "Altima", "Black", main],
    ["3FA6P0H76JR210998", "D998", "2018", "Ford", "Fusion", "Blue", main],
    ["1C4RJFBG4JC123789", "E789", "2019", "Jeep", "Grand Cherokee", "Red", main],
    ["KL8CB6SA0JC512334", "F334", "2018", "Chevrolet", "Spark", "Gray", main],
    ["5NPE34AF4JH123887", "G887", "2018", "Hyundai", "Sonata", "White", north],
    ["1G1ZD5ST4JF140221", "H221", "2018", "Chevrolet", "Malibu", "Black", north],
    ["KNDJP3A59J7120441", "J441", "2018", "Kia", "Soul", "Green", north],
    ["2HKRW2H54JH612009", "K009", "2018", "Honda", "CR-V", "Silver", service],
    ["1FMCU0GD4JUA20331", "L331", "2018", "Ford", "Escape", "White", service],
    ["3N1AB7AP8JY228441", "M441", "2018", "Nissan", "Sentra", "Blue", main],
  ];

  const importedAt = now();
  const inventory: InventoryItem[] = cars.map(([vin, stock, year, make, model, color, loc]) => ({
    id: uid(),
    dealershipId: dealer.id,
    vin,
    stockNumber: stock,
    year,
    make,
    model,
    color,
    expectedLocationName: loc.name,
    expectedLocationId: loc.id,
    importedAt,
  }));

  db.dealerships.push(dealer);
  db.locations.push(main, north, service);
  db.profiles.push(manager, porter);
  db.passwords[manager.id] = DEMO_PASSWORD;
  db.passwords[porter.id] = DEMO_PASSWORD;
  db.inventory.push(...inventory);
  return manager;
}

export async function signInDemo(): Promise<AuthSession> {
  if (supabaseConfigured) {
    throw new Error("Demo lot is for local mode. Connect your own dealership with email signup.");
  }
  const db = loadDb();
  const user = seedDemo(db);
  setCurrentUserId(user.id);
  const main = db.locations.find((l) => l.dealershipId === user.dealershipId && l.name === "Main Lot");
  if (main) writeActiveLocationId(main.id);
  saveDb(db);
  const session = sessionFromDb(db, user.id);
  if (!session) throw new Error("Demo failed to load.");
  return session;
}

export async function listLocations(dealershipId: string): Promise<Location[]> {
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("locations")
      .select("id, dealership_id, name, kind")
      .eq("dealership_id", dealershipId)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      dealershipId: row.dealership_id,
      name: row.name,
      kind: row.kind,
    }));
  }
  return loadDb()
    .locations.filter((l) => l.dealershipId === dealershipId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getActiveLocationId(locations: Location[]): string | null {
  const saved = readActiveLocationId();
  if (saved && locations.some((l) => l.id === saved)) return saved;
  return locations[0]?.id ?? null;
}

export function setActiveLocation(id: string) {
  writeActiveLocationId(id);
}

export async function createLocation(
  session: AuthSession,
  name: string,
  kind: LocationKind,
): Promise<Location> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the lot.");
  const live = (await getSession()) ?? session;
  const existing = await listLocations(live.dealership.id);
  const blocked = canAddLocation(live.dealership, existing, kind);
  if (blocked) throw new Error(blocked);

  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("locations")
      .insert({ dealership_id: live.dealership.id, name: trimmed, kind })
      .select("id, dealership_id, name, kind")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return {
      id: data.id,
      dealershipId: data.dealership_id,
      name: data.name,
      kind: data.kind,
    };
  }

  const location: Location = {
    id: uid(),
    dealershipId: live.dealership.id,
    name: trimmed,
    kind,
  };
  const db = loadDb();
  db.locations.push(location);
  saveDb(db);
  return location;
}

export async function renameLocation(session: AuthSession, locationId: string, name: string): Promise<Location> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the lot.");
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("locations")
      .update({ name: trimmed })
      .eq("id", locationId)
      .eq("dealership_id", session.dealership.id)
      .select("id, dealership_id, name, kind")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return {
      id: data.id,
      dealershipId: data.dealership_id,
      name: data.name,
      kind: data.kind,
    };
  }
  const db = loadDb();
  const location = db.locations.find((l) => l.id === locationId && l.dealershipId === session.dealership.id);
  if (!location) throw new Error("Location not found.");
  location.name = trimmed;
  saveDb(db);
  return location;
}

export async function getOpenSession(
  dealershipId: string,
  locationId: string,
): Promise<AuditSession | null> {
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("audit_sessions")
      .select("id, dealership_id, location_id, started_by, started_at, ended_at, status")
      .eq("dealership_id", dealershipId)
      .eq("location_id", locationId)
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      dealershipId: data.dealership_id,
      locationId: data.location_id,
      startedBy: data.started_by,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      status: data.status,
    };
  }
  return (
    loadDb().auditSessions.find(
      (s) => s.dealershipId === dealershipId && s.locationId === locationId && s.status === "open",
    ) ?? null
  );
}

export async function startAudit(session: AuthSession, locationId: string): Promise<AuditSession> {
  const open = await getOpenSession(session.dealership.id, locationId);
  if (open) return open;
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("audit_sessions")
      .insert({
        dealership_id: session.dealership.id,
        location_id: locationId,
        started_by: session.user.id,
        status: "open",
      })
      .select("id, dealership_id, location_id, started_by, started_at, ended_at, status")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return {
      id: data.id,
      dealershipId: data.dealership_id,
      locationId: data.location_id,
      startedBy: data.started_by,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      status: data.status,
    };
  }
  const audit: AuditSession = {
    id: uid(),
    dealershipId: session.dealership.id,
    locationId,
    startedBy: session.user.id,
    startedAt: now(),
    endedAt: null,
    status: "open",
  };
  const db = loadDb();
  db.auditSessions.push(audit);
  saveDb(db);
  return audit;
}

export async function closeAudit(auditId: string) {
  const sb = await cloudClient();
  if (sb) {
    const { error } = await sb
      .from("audit_sessions")
      .update({ status: "closed", ended_at: now() })
      .eq("id", auditId);
    if (error) throw new Error(error.message);
    emit();
    return;
  }
  const db = loadDb();
  const audit = db.auditSessions.find((s) => s.id === auditId);
  if (audit) {
    audit.status = "closed";
    audit.endedAt = now();
    saveDb(db);
  }
}

export type ScanResult =
  | { ok: true; scan: Scan; duplicate: boolean }
  | { ok: false; error: string; code?: "vin_cap" };

export async function logScan(
  session: AuthSession,
  location: Location,
  audit: AuditSession,
  rawVin: string,
  source: ScanSource,
): Promise<ScanResult> {
  const vin = extractVin(rawVin) ?? normalizeVin(rawVin);
  if (!isValidVin(vin)) {
    return { ok: false, error: "Need a valid 17-character VIN (no I, O, or Q)." };
  }

  const existing = await listScans(session.dealership.id, audit.id);
  const duplicate = existing.some((s) => s.vin === vin);
  const live = (await getSession()) ?? session;
  if (!duplicate && vinCapReached(live.dealership, uniqueVinCount(existing))) {
    return {
      ok: false,
      code: "vin_cap",
      error: "Free includes up to 100 scanned units/VINs per audit. Go Pro for unlimited scanning.",
    };
  }

  const sb = await cloudClient();
  if (sb) {
    if (duplicate) {
      const prev = existing.find((s) => s.vin === vin)!;
      return { ok: true, scan: prev, duplicate: true };
    }
    const { data, error } = await sb
      .from("scans")
      .insert({
        dealership_id: session.dealership.id,
        session_id: audit.id,
        location_id: location.id,
        vin,
        scanned_by: session.user.id,
        source,
      })
      .select("id, dealership_id, session_id, location_id, vin, scanned_by, scanned_at, source")
      .single();
    if (error) return { ok: false, error: error.message };
    emit();
    return {
      ok: true,
      duplicate: false,
      scan: {
        id: data.id,
        dealershipId: data.dealership_id,
        sessionId: data.session_id,
        locationId: data.location_id,
        locationName: location.name,
        vin: data.vin,
        scannedBy: data.scanned_by,
        scannerName: session.user.fullName,
        scannedAt: data.scanned_at,
        source: data.source,
      },
    };
  }

  if (duplicate) {
    const prev = existing.find((s) => s.vin === vin)!;
    return { ok: true, scan: prev, duplicate: true };
  }
  const scan: Scan = {
    id: uid(),
    dealershipId: session.dealership.id,
    sessionId: audit.id,
    locationId: location.id,
    locationName: location.name,
    vin,
    scannedBy: session.user.id,
    scannerName: session.user.fullName,
    scannedAt: now(),
    source,
  };
  const db = loadDb();
  db.scans.push(scan);
  saveDb(db);
  return { ok: true, scan, duplicate: false };
}

export async function listScans(dealershipId: string, sessionId?: string): Promise<Scan[]> {
  const sb = await cloudClient();
  if (sb) {
    let q = sb
      .from("scans")
      .select(
        "id, dealership_id, session_id, location_id, vin, scanned_by, scanned_at, source, locations(name), profiles(full_name)",
      )
      .eq("dealership_id", dealershipId)
      .order("scanned_at", { ascending: false });
    if (sessionId) q = q.eq("session_id", sessionId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const loc = row.locations as unknown as { name: string } | { name: string }[] | null;
      const prof = row.profiles as unknown as { full_name: string } | { full_name: string }[] | null;
      const locName = Array.isArray(loc) ? loc[0]?.name : loc?.name;
      const name = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;
      return {
        id: row.id,
        dealershipId: row.dealership_id,
        sessionId: row.session_id,
        locationId: row.location_id,
        locationName: locName ?? "Lot",
        vin: row.vin,
        scannedBy: row.scanned_by,
        scannerName: name ?? "Teammate",
        scannedAt: row.scanned_at,
        source: row.source,
      };
    });
  }
  const db = loadDb();
  return db.scans
    .filter((s) => s.dealershipId === dealershipId && (!sessionId || s.sessionId === sessionId))
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

export async function deleteScan(session: AuthSession, scanId: string) {
  const sb = await cloudClient();
  if (sb) {
    const { error } = await sb
      .from("scans")
      .delete()
      .eq("id", scanId)
      .eq("dealership_id", session.dealership.id);
    if (error) throw new Error(error.message);
    emit();
    return;
  }
  const db = loadDb();
  db.scans = db.scans.filter((s) => !(s.id === scanId && s.dealershipId === session.dealership.id));
  saveDb(db);
}

export async function listInventory(dealershipId: string): Promise<InventoryItem[]> {
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("inventory_items")
      .select(
        "id, dealership_id, vin, stock_number, year, make, model, color, expected_location_name, expected_location_id, imported_at",
      )
      .eq("dealership_id", dealershipId)
      .order("make");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      dealershipId: row.dealership_id,
      vin: row.vin,
      stockNumber: row.stock_number,
      year: row.year,
      make: row.make,
      model: row.model,
      color: row.color,
      expectedLocationName: row.expected_location_name,
      expectedLocationId: row.expected_location_id,
      importedAt: row.imported_at,
    }));
  }
  return loadDb().inventory.filter((i) => i.dealershipId === dealershipId);
}

export async function importInventoryCsv(
  session: AuthSession,
  locations: Location[],
  csvText: string,
): Promise<{ count: number; skipped: number }> {
  if (!canImportCsv(session.dealership, session.user.role)) {
    throw new Error("DMS Master Baseline upload is a Pro feature for managers.");
  }
  const parsed = parseInventoryCsv(csvText);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.vehicles.length === 0) throw new Error("No VIN rows found in that DMS Master List CSV.");

  const locByName = new Map(locations.map((l) => [l.name.trim().toLowerCase(), l]));
  const importedAt = now();
  const items: InventoryItem[] = parsed.vehicles.map((v) => {
    const loc = locByName.get(v.location.trim().toLowerCase()) ?? null;
    return {
      id: uid(),
      dealershipId: session.dealership.id,
      vin: v.vin,
      stockNumber: v.stockNumber,
      year: v.year,
      make: v.make,
      model: v.model,
      color: v.color,
      expectedLocationName: loc?.name ?? v.location,
      expectedLocationId: loc?.id ?? null,
      importedAt,
    };
  });

  // Replace the current DMS Master Baseline only. Scans, audit sessions, and
  // historical Walk Reports are never deleted by a baseline upload.
  const sb = await cloudClient();
  if (sb) {
    await sb.from("inventory_items").delete().eq("dealership_id", session.dealership.id);
    const { error } = await sb.from("inventory_items").insert(
      items.map((item) => ({
        id: item.id,
        dealership_id: item.dealershipId,
        vin: item.vin,
        stock_number: item.stockNumber,
        year: item.year,
        make: item.make,
        model: item.model,
        color: item.color,
        expected_location_name: item.expectedLocationName,
        expected_location_id: item.expectedLocationId,
        imported_at: item.importedAt,
      })),
    );
    if (error) throw new Error(error.message);
    emit();
    return { count: items.length, skipped: parsed.skipped };
  }

  const db = loadDb();
  db.inventory = db.inventory.filter((i) => i.dealershipId !== session.dealership.id);
  db.inventory.push(...items);
  saveDb(db);
  return { count: items.length, skipped: parsed.skipped };
}

export async function getReconcile(
  session: AuthSession,
  location: Location,
  auditId: string,
): Promise<ReconcileResult> {
  if (!isPro(session.dealership)) {
    throw new Error("Discrepancy reports are a Pro feature.");
  }
  const [scans, inventory] = await Promise.all([
    listScans(session.dealership.id, auditId),
    listInventory(session.dealership.id),
  ]);
  return reconcileInventory(scans, inventory, location.id, location.name);
}

export async function listTeam(dealershipId: string): Promise<Profile[]> {
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, dealership_id, email, full_name, role")
      .eq("dealership_id", dealershipId)
      .order("full_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      dealershipId: row.dealership_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
    }));
  }
  return loadDb()
    .profiles.filter((p) => p.dealershipId === dealershipId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listInvites(dealershipId: string): Promise<Invite[]> {
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("invites")
      .select("id, dealership_id, code, email, role, created_at, used_at")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      dealershipId: row.dealership_id,
      code: row.code,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      usedAt: row.used_at,
    }));
  }
  return loadDb()
    .invites.filter((i) => i.dealershipId === dealershipId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createInvite(
  session: AuthSession,
  email: string,
  role: Role,
): Promise<Invite> {
  if (!canInviteTeam(session.dealership, session.user.role)) {
    throw new Error("Team logins are a Pro feature for managers.");
  }
  const invite: Invite = {
    id: uid(),
    dealershipId: session.dealership.id,
    code: inviteCode(),
    email: email.trim().toLowerCase(),
    role,
    createdAt: now(),
    usedAt: null,
  };
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("invites")
      .insert({
        dealership_id: invite.dealershipId,
        code: invite.code,
        email: invite.email,
        role: invite.role,
      })
      .select("id, dealership_id, code, email, role, created_at, used_at")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return {
      id: data.id,
      dealershipId: data.dealership_id,
      code: data.code,
      email: data.email,
      role: data.role,
      createdAt: data.created_at,
      usedAt: data.used_at,
    };
  }
  const db = loadDb();
  db.invites.push(invite);
  saveDb(db);
  return invite;
}

export async function setPlan(session: AuthSession, plan: Plan): Promise<Dealership> {
  if (session.user.role !== "manager") throw new Error("Only managers can change the plan.");
  if (plan === "pro" && supabaseConfigured && session.kind !== "cloud") {
    throw new Error("Sign in with a manager account to activate Pro, extra lots, and team logins.");
  }
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("dealerships")
      .update({ plan })
      .eq("id", session.dealership.id)
      .select("id, name, plan, created_at")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return { id: data.id, name: data.name, plan: data.plan, createdAt: data.created_at };
  }
  const db = loadDb();
  const dealer = db.dealerships.find((d) => d.id === session.dealership.id);
  if (!dealer) throw new Error("Dealership not found.");
  dealer.plan = plan;
  saveDb(db);
  return dealer;
}

export async function renameDealership(session: AuthSession, name: string): Promise<Dealership> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Dealership name is required.");
  if (session.user.role !== "manager") throw new Error("Only managers can rename the dealership.");
  const sb = await cloudClient();
  if (sb) {
    const { data, error } = await sb
      .from("dealerships")
      .update({ name: trimmed })
      .eq("id", session.dealership.id)
      .select("id, name, plan, created_at")
      .single();
    if (error) throw new Error(error.message);
    emit();
    return { id: data.id, name: data.name, plan: data.plan, createdAt: data.created_at };
  }
  const db = loadDb();
  const dealer = db.dealerships.find((d) => d.id === session.dealership.id);
  if (!dealer) throw new Error("Dealership not found.");
  dealer.name = trimmed;
  saveDb(db);
  return dealer;
}

export { DEMO_EMAIL, DEMO_PASSWORD, supabaseConfigured };
