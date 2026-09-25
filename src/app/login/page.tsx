"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import {
  continueLocal,
  listLocalAccounts,
  signIn,
  signInDemo,
  supabaseConfigured,
  type LocalAccount,
} from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(!supabaseConfigured);
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const started = useRef(false);

  async function goScan(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      router.replace("/scan");
    } catch (err) {
      setOpening(false);
      setError(err instanceof Error ? err.message : "Could not open the lot.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const existing = listLocalAccounts();
    setAccounts(existing);
    if (started.current || supabaseConfigured) {
      setOpening(false);
      return;
    }
    started.current = true;
    if (existing.length === 1) {
      void goScan(() => continueLocal(existing[0].id));
      return;
    }
    if (existing.length === 0) {
      void goScan(() => signInDemo());
      return;
    }
    setOpening(false);
  }, []);

  if (opening && !error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 py-10">
        <Logo />
        <p className="text-lg font-bold text-cyan">Opening your lot…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Open your lot</h1>
        <p className="mt-1 font-semibold text-muted">
          {accounts.length ? "Pick a lot on this device." : "This device remembers your lot. No password wall."}
        </p>
      </div>

      {accounts.map((account) => (
        <Button
          key={account.id}
          disabled={busy}
          className="w-full normal-case tracking-normal"
          onClick={() => void goScan(() => continueLocal(account.id))}
        >
          Continue as {account.fullName} · {account.dealershipName}
        </Button>
      ))}

      {error ? <p className="font-bold text-alert">{error}</p> : null}

      <p className="text-sm font-semibold text-muted">
        New dealership?{" "}
        <Link href="/signup" className="text-cyan">
          Create a lot
        </Link>
      </p>

      <button
        type="button"
        className="text-left text-xs font-extrabold uppercase tracking-wide text-muted"
        onClick={() => setShowEmail((v) => !v)}
      >
        {showEmail ? "Hide email sign-in" : "Use email instead"}
      </button>

      {showEmail ? (
        <>
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
                if (e.key === "Enter") void goScan(() => signIn(email, password || "lot"));
              }}
            />
          </Field>
          <Button variant="line" onClick={() => void goScan(() => signIn(email, password || "lot"))} disabled={busy} className="w-full">
            Sign in with email
          </Button>
        </>
      ) : null}
    </div>
  );
}
