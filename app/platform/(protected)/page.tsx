"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformDashboardStatsDTO } from "@/lib/api/platformDashboard";
import { getDashboardStats } from "@/lib/api/platformDashboard";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * §5.29 sous-lot 7 (dernier de §5.29) — tableau de bord global. Volontairement
 * minimal (3 agrégats simples) : c'est ce qui était retenu au périmètre validé,
 * pas un système de reporting.
 */
function StatCard({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-flat">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-sm text-ink-muted">{detail}</p> : null}
    </div>
  );
}

export default function PlatformHomePage() {
  const { platformAdmin, authedFetch } = usePlatformAuth();

  const [stats, setStats] = useState<PlatformDashboardStatsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStats(await authedFetch((token) => getDashboardStats(token)));
    } catch {
      setError("Impossible de charger le tableau de bord.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Console Super Admin</p>
        <h1 className="font-display text-2xl font-bold text-ink">
          Bienvenue, {platformAdmin?.name ?? platformAdmin?.email}
        </h1>
      </header>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : isLoading || !stats ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Organisations"
            value={stats.organizations.total}
            detail={`${stats.organizations.active} active${stats.organizations.active > 1 ? "s" : ""} · ${stats.organizations.suspended} suspendue${stats.organizations.suspended > 1 ? "s" : ""}`}
          />
          <StatCard label="Utilisateurs" value={stats.users.total} detail="toutes organisations confondues" />
          <StatCard label="Appels traités" value={stats.calls.total} detail="toutes organisations confondues" />
        </div>
      )}
    </div>
  );
}
