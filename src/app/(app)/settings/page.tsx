"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useRequiredSession } from "@/components/AuthProvider";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";
import { canAddLocation, isManager, isPro, planLabel } from "@/lib/plan";
import {
  createLocation,
  listLocations,
  renameDealership,
  signOut,
  supabaseConfigured,
} from "@/lib/store";
import type { Location, LocationKind } from "@/lib/types";
import { kindLabel } from "@/components/LocationSwitcher";

export default function SettingsPage() {
  const session = useRequiredSession();
  const { refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(session.dealership.name);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lotName, setLotName] = useState("");
  const [kind, setKind] = useState<LocationKind>("sales_lot");
  const [error, setError] = useState<string | null>(null);
  const manager = isManager(session.user.role);

  async function load() {
    if (!session.dealership.id) return;
    setLocations(await listLocations(session.dealership.id));
    setName(session.dealership.name);
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id, session.dealership.name]);

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

  async function leave() {
    await signOut();
    await refresh();
    router.replace("/login");
  }

  const addBlocked = canAddLocation(session.dealership, locations, kind);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-black">Settings</h1>
      <Card>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-cyan">Signed in</p>
        <p className="text-xl font-black">{session.user.fullName}</p>
        <p className="font-semibold text-muted">
          {session.user.email} · {session.user.role === "manager" ? "Manager / Admin" : "Lot Porter / Attendant"}
        </p>
        <p className="mt-2 text-sm font-bold">
          Plan: {planLabel(session.dealership.plan)}
          {supabaseConfigured ? " · Supabase" : " · Local demo"}
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
        {locations.map((loc) => (
          <p key={loc.id} className="font-bold">
            {loc.name} · {kindLabel(loc.kind)}
          </p>
        ))}
        {manager ? (
          <>
            <Field label="Add location">
              <TextInput value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="North Lot" />
            </Field>
            <Select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
              <option value="sales_lot">Sales lot</option>
              <option value="service_center">Service center</option>
            </Select>
            {addBlocked && !isPro(session.dealership) ? (
              <Link href="/upgrade" className="text-sm font-extrabold text-cyan">
                {addBlocked}
              </Link>
            ) : null}
            <Button variant="line" onClick={() => void addLot()} disabled={Boolean(addBlocked)}>
              Add location
            </Button>
          </>
        ) : null}
      </Card>

      {manager ? (
        <div className="grid gap-3">
          <Link href="/upgrade">
            <Button className="w-full">{isPro(session.dealership) ? "Manage Pro" : "Upgrade to Pro"}</Button>
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

      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <Button variant="alert" onClick={() => void leave()}>
        Sign out
      </Button>
    </div>
  );
}
