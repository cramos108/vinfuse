"use client";

import { useEffect, useState } from "react";
import { useRequiredSession } from "@/components/AuthProvider";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";
import { canInviteTeam } from "@/lib/plan";
import { createInvite, listInvites, listTeam } from "@/lib/store";
import type { Invite, Profile, Role } from "@/lib/types";

export default function TeamPage() {
  const session = useRequiredSession();
  const [team, setTeam] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("porter");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!session.dealership.id) return;
    setTeam(await listTeam(session.dealership.id));
    if (canInviteTeam(session.dealership, session.user.role)) {
      setInvites(await listInvites(session.dealership.id));
    }
  }

  useEffect(() => {
    void load();
  }, [session.dealership.id, session.dealership.plan]);

  if (!canInviteTeam(session.dealership, session.user.role)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-black">Team</h1>
        <UpgradeGate
          title="Multi-user team logins"
          body="Pro lets managers invite lot porters and extra admins. Free is a single-location, single-operator scan log."
        />
      </div>
    );
  }

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      await createInvite(session, email, role);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">Pro</p>
        <h1 className="text-3xl font-black">Team logins</h1>
      </div>
      <Card className="flex flex-col gap-3">
        <Field label="Teammate email">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="porter@lot.com" />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="porter">Lot porter / attendant</option>
            <option value="manager">Manager / admin</option>
          </Select>
        </Field>
        {error ? <p className="font-bold text-alert">{error}</p> : null}
        <Button onClick={invite} disabled={busy || !email}>
          Create invite code
        </Button>
      </Card>
      <h2 className="text-xl font-black">People</h2>
      {team.map((person) => (
        <Card key={person.id} className="p-4">
          <p className="font-black">{person.fullName}</p>
          <p className="text-sm font-semibold text-muted">
            {person.email} · {person.role === "manager" ? "Manager / Admin" : "Lot Porter / Attendant"}
          </p>
        </Card>
      ))}
      <h2 className="text-xl font-black">Open invites</h2>
      {invites.filter((i) => !i.usedAt).map((invite) => (
        <Card key={invite.id} className="p-4">
          <p className="font-mono text-2xl font-black text-cyan">{invite.code}</p>
          <p className="text-sm font-semibold text-muted">
            {invite.email || "Any teammate"} · {invite.role === "manager" ? "Manager" : "Porter"}
          </p>
        </Card>
      ))}
    </div>
  );
}
