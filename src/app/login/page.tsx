"use client";

import { useEffect, useState } from "react";
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
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);

  useEffect(() => {
    setAccounts(listLocalAccounts());
    const demo = new URLSearchParams(window.location.search).get("demo") === "1";
    if (demo && !supabaseConfigured) void enterDemo();
  }, []);

  async function goScan(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the lot.");
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    await goScan(() => signInDemo());
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Get on the lot</h1>
        <p className="mt-1 font-semibold text-muted">
          One tap for the demo. This device remembers your lot — no password wall.
        </p>
      </div>

      {!supabaseConfigured ? (
        <Button onClick={() => void enterDemo()} disabled={busy} className="w-full">
          Try the Suncoast demo lot
        </Button>
      ) : null}

      {accounts.map((account) => (
        <Button
          key={account.id}
          variant="line"
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
          Create a lot in seconds
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
          <Field label="Password" hint={supabaseConfigured ? undefined : "Only if you set one. Local lots can skip this."}>
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
