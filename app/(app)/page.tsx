"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AuthUser } from "@/lib/auth/AuthContext";

/** Placeholder du lot 2 — vérifie que le shell + l'auth Bearer fonctionnent de bout en bout via un vrai GET /auth/me. La file d'appels (§5.5) arrive au lot 3. */
export default function HomePage() {
  const { user, authedFetch } = useAuth();
  const [meCheck, setMeCheck] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    authedFetch((token) => apiClient.get<{ user: AuthUser }>("/auth/me", token))
      .then(() => setMeCheck("ok"))
      .catch(() => setMeCheck("error"));
  }, [authedFetch]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-10">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Lot 2 — socle</p>
        <h1 className="font-display text-3xl font-bold text-ink">Bonjour {user?.firstName ?? user?.email}.</h1>
        <p className="text-ink-muted">{user?.organization.name}</p>
      </header>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-flat">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">État de la connexion</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Rôle</dt>
            <dd className="font-medium text-ink">{user?.roleName}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Permissions</dt>
            <dd className="font-mono text-ink">{user?.permissions.length}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">GET /auth/me (Bearer + retry-on-401)</dt>
            <dd>
              {meCheck === "idle" ? (
                <StatusBadge label="en cours…" />
              ) : meCheck === "ok" ? (
                <StatusBadge label="connecté" color="#2f7d5a" />
              ) : (
                <StatusBadge label="échec" color="#b3432f" />
              )}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-sm text-ink-muted">
        <kbd className="rounded-sm border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-xs">
          {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K
        </kbd>{" "}
        ouvre la palette de commandes.
      </p>
    </div>
  );
}
