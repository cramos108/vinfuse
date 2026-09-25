"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import { signUp, supabaseConfigured } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [more, setMore] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function goScan(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the lot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Open a lot</h1>
        <p className="mt-1 font-semibold text-muted">
          {supabaseConfigured
            ? "Name, email, and a short password. Porters can paste an invite code."
            : "Just your name. This device keeps the lot — no password required."}
        </p>
      </div>

      <Field label="Your name">
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
      </Field>
      <Field label="Dealership" hint="Optional. We will name the lot after you if you skip it.">
        <TextInput
          value={dealershipName}
          onChange={(e) => setDealershipName(e.target.value)}
          placeholder="Suncoast Auto"
        />
      </Field>
      <Field label="Invite code" hint="Porters only — paste the 6-character code from a manager.">
        <TextInput
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="AB12CD"
          autoCapitalize="characters"
        />
      </Field>

      {more ? (
        <>
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lot.com" />
          </Field>
          <Field label="Password">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </>
      ) : (
        <button
          type="button"
          className="text-left text-xs font-extrabold uppercase tracking-wide text-muted"
          onClick={() => setMore(true)}
        >
          Add email (optional)
        </button>
      )}

      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <Button
        onClick={() => void goScan(() => signUp({ email, password, fullName, dealershipName, inviteCode }))}
        disabled={busy}
        className="w-full"
      >
        Start scanning
      </Button>
      <p className="text-sm font-semibold text-muted">
        Already on this device?{" "}
        <Link href="/login" className="text-cyan">
          Open your lot
        </Link>
      </p>
    </div>
  );
}
