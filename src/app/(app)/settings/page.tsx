"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useRequiredSession } from "@/components/AuthProvider";
import { PrivacyCard } from "@/components/PrivacyPanel";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";
import { kindLabel } from "@/components/LocationSwitcher";
import { canAddLocation, isManager, isPro, planLabel } from "@/lib/plan";
import {
  createLocation,
  listLocations,
  renameDealership,
  renameLocation,
  signOut,
  wipeLocalWalkData,
} from "@/lib/store";
import type { Location, LocationKind } from "@/lib/types";

export default function SettingsPage() {
  const session = useRequiredSession();
  const { refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(session.dealership.name);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lotName, setLotName] = useState("");
  const [kind, setKind] = useState<LocationKind>("sales_lot");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const manager = isManager(session.user.role);
  const pro = isPro(session.dealership);
  const addBlocked = canAddLocation(session.dealership, locations, kind);

  async function load() {
    if (!session.dealership.id) return;
    setLocations(await listLocations(session.dealership.id));
    setName(session.dealership.name);
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id, session.dealership.name, session.dealership.plan]);

  async function saveName() {
    setError(null);
    try {
      await renameDealership(session, name);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function addLot() {
    setError(null);
    try {
      await createLocation(session, lotName, kind);
      setLotName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add location.");
    }
  }

  async function saveLotName(id: string) {
    setError(null);
    try {
      await renameLocation(session, id, editingName);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename location.");
    }
  }

  async function leave() {
    await signOut();
    await refresh();
    router.replace("/scan");
  }

  function clearWalks() {
    if (
      !confirm(
        "Clear local walk history and open scan logs on this device? This cannot be undone. Manager cloud data is not affected.",
      )
    ) {
      return;
    }
    wipeLocalWalkData(session.dealership.id);
    setNotice("Local walk history and scan logs on this device were cleared.");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-black">Settings</h1>
      <Card>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-cyan">
          {session.kind === "local" ? "This device" : "Signed in"}
        </p>
        <p className="text-xl font-black">{session.kind === "local" ? "On-device scanner" : session.user.fullName}</p>
        <p className="font-semibold text-muted">
          {session.kind === "local"
            ? "Porters scan and save walks here with no login."
            : `${session.user.email} · ${session.user.role === "manager" ? "Manager / Admin" : "Lot Porter / Attendant"}`}
        </p>
        <p className="mt-2 text-sm font-bold">
          Plan: {planLabel(session.dealership.plan)}
          {pro ? " · unlimited VINs and lots" : " · up to 100 scanned units/VINs per audit"}
          {session.kind === "cloud" ? " · Dealership workspace" : " · This device"}
        </p>
      </Card>

      {manager ? (
        <Card className="flex flex-col gap-3">
          <Field label="Dealership">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button variant="line" onClick={() => void saveName()}>
            Save name
          </Button>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Locations</h2>
        {pro ? (
          <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
            Pro is active. Add sales lots (West Lot, North Lot, …) and service centers as you need them.
          </p>
        ) : (
          <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
            Free includes one location. Upgrade to Pro to add more lots.
          </p>
        )}
        {locations.map((loc) => (
          <div key={loc.id} className="flex flex-col gap-2">
            {editingId === loc.id ? (
              <>
                <TextInput value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="line" className="min-h-11 text-xs" onClick={() => void saveLotName(loc.id)}>
                    Save
                  </Button>
                  <Button variant="ghost" className="min-h-11 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">
                  {loc.name} · {kindLabel(loc.kind)}
                </p>
                {manager ? (
                  <button
                    type="button"
                    className="text-xs font-extrabold uppercase tracking-wide text-cyan"
                    onClick={() => {
                      setEditingId(loc.id);
                      setEditingName(loc.name);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {manager ? (
          <>
            <Field label="Add location">
              <TextInput value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="West Lot" />
            </Field>
            <Select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
              <option value="sales_lot">Sales lot</option>
              <option value="service_center">Service center</option>
            </Select>
            {addBlocked ? (
              <Link href="/upgrade" className="text-sm font-extrabold text-cyan">
                {addBlocked}
              </Link>
            ) : null}
            <Button variant="line" onClick={() => void addLot()} disabled={Boolean(addBlocked) || !lotName.trim()}>
              Add location
            </Button>
          </>
        ) : null}
      </Card>

      {manager ? (
        <div className="grid gap-3">
          <Link href="/upgrade">
            <Button className="w-full">{pro ? "Manage Pro" : "Upgrade to Pro"}</Button>
          </Link>
          <Link href="/team">
            <Button variant="line" className="w-full">
              Team logins
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="line" className="w-full">
              DMS Master List
            </Button>
          </Link>
        </div>
      ) : null}

      <Link href="/history">
        <Button variant="line" className="w-full">
          Walk History
        </Button>
      </Link>

      <PrivacyCard />

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Data on this device</h2>
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">
          Wipe walk archives and open scan logs stored in this browser. Use this after a test walk.
        </p>
        <Button variant="line" onClick={clearWalks}>
          Clear local walk history
        </Button>
      </Card>

      {notice ? <p className="font-bold text-ok">{notice}</p> : null}
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      {session.kind === "cloud" ? (
        <Button variant="alert" onClick={() => void leave()}>
          Sign out of manager account
        </Button>
      ) : (
        <Link href="/login">
          <Button variant="line" className="w-full">
            Manager sign in
          </Button>
        </Link>
      )}
    </div>
  );
}
