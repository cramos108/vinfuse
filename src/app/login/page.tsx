"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import { DEMO_EMAIL, DEMO_PASSWORD, signIn, signInDemo, supabaseConfigured } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      await signInDemo();
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Sign in</h1>
        <p className="mt-1 font-semibold text-muted">Open your dealership audit workspace.</p>
      </div>
      <Field label="Email">
        <TextInput
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lot.com"
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
      <Button onClick={submit} disabled={busy} className="w-full">
        Sign in
      </Button>
      {!supabaseConfigured ? (
        <Button variant="line" onClick={demo} disabled={busy} className="w-full">
          Try the Suncoast demo lot
        </Button>
      ) : null}
      <p className="text-sm font-semibold text-muted">
        New dealership?{" "}
        <Link href="/signup" className="text-cyan">
          Create an account
        </Link>
      </p>
      {!supabaseConfigured ? (
        <p className="text-xs font-semibold text-muted">
          Local demo · {DEMO_EMAIL} / {DEMO_PASSWORD}
        </p>
      ) : null}
    </div>
  );
}
