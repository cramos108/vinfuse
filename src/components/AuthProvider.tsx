"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootDevPro } from "@/lib/plan";
import { getSession, subscribeStore } from "@/lib/store";
import { bootTheme } from "@/lib/theme";
import { getSupabase } from "@/lib/supabase";
import type { AuthSession } from "@/lib/types";

type AuthState = {
  session: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  async function refresh() {
    const next = await getSession();
    setSession(next);
  }

  useEffect(() => {
    bootTheme();
    bootDevPro();
    let alive = true;
    getSession()
      .then((next) => {
        if (alive) setSession(next);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsubStore = subscribeStore(() => {
      getSession().then((next) => {
        if (alive) setSession(next);
      });
    });
    const sb = getSupabase();
    const authSub = sb?.auth.onAuthStateChange(() => {
      getSession().then((next) => {
        if (alive) setSession(next);
      });
    });
    return () => {
      unsubStore();
      authSub?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    bootDevPro();
    if (loading) return;
    if (session?.kind === "cloud" && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/scan");
    }
  }, [loading, session, pathname, router]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      refresh,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

const EMPTY_SESSION: AuthSession = {
  user: { id: "", dealershipId: "", email: "", fullName: "", role: "porter" },
  dealership: { id: "", name: "", plan: "free", createdAt: "" },
  kind: "local",
};

export function useRequiredSession(): AuthSession {
  const { session } = useAuth();
  return session ?? EMPTY_SESSION;
}
