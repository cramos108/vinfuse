"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import { requestPasswordReset, signIn } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signIn(email, password);
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(email);
      setNotice("Check your email for the password reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Dealership workspace</h1>
        <p className="mt-1 font-semibold text-muted">
          Sign in to your secure manager account for Pro, extra lots, and team. Porters scan on this device with no
          login.
        </p>
      </div>
      <Link href="/scan" className="text-sm font-extrabold uppercase tracking-wide text-cyan">
        ← Back to scanner
      </Link>
      <Field label="Email">
        <TextInput
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="gm@dealership.com"
        />
      </Field>
      <Field label="Password">
        <TextInput
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
      </Field>
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      {notice ? <p className="font-bold text-ok">{notice}</p> : null}
      <Button onClick={() => void submit()} disabled={busy || !email || !password} className="w-full">
        Sign in
      </Button>
      <button
        type="button"
        className="text-left text-sm font-extrabold text-cyan"
        disabled={busy}
        onClick={() => void reset()}
      >
        Forgot password?
      </button>
      <p className="text-sm font-semibold text-muted">
        Need a manager account?{" "}
        <Link href="/signup" className="text-cyan">
          Create one
        </Link>
      </p>
    </div>
  );
}
