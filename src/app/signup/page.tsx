"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import { signUp } from "@/lib/store";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp({ email, password, fullName, dealershipName, inviteCode });
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Create your lot</h1>
        <p className="mt-1 font-semibold text-muted">Managers start a dealership. Porters join with an invite code.</p>
      </div>
      <Field label="Your name">
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
      </Field>
      <Field label="Dealership name" hint="Skip if you have a team invite code.">
        <TextInput
          value={dealershipName}
          onChange={(e) => setDealershipName(e.target.value)}
          placeholder="Suncoast Auto"
        />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lot.com" />
      </Field>
      <Field label="Password">
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Invite code" hint="Optional. Porters / extra managers paste the 6-character code.">
        <TextInput
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="AB12CD"
          autoCapitalize="characters"
        />
      </Field>
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <Button onClick={submit} disabled={busy} className="w-full">
        Create account
      </Button>
      <p className="text-sm font-semibold text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-cyan">
          Sign in
        </Link>
      </p>
    </div>
  );
}
