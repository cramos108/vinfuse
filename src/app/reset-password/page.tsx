"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button, Field, TextInput } from "@/components/ui";
import { updatePassword } from "@/lib/store";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-3xl font-black">Set a new password</h1>
        <p className="mt-1 font-semibold text-muted">Choose a password for your manager account, then return to the lot.</p>
      </div>
      <Field label="New password">
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Confirm">
        <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      {error ? <p className="font-bold text-alert">{error}</p> : null}
      <Button onClick={() => void submit()} disabled={busy || password.length < 6} className="w-full">
        Save password
      </Button>
      <Link href="/login" className="text-sm font-extrabold text-cyan">
        Back to manager sign in
      </Link>
    </div>
  );
}
