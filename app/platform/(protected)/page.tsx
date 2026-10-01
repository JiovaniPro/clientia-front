"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  formatCount,
  PlatformNotice,
  PlatformPage,
  PlatformPageHeader,
} from "@/components/platform/PlatformPage";
import type { PlatformDashboardStatsDTO } from "@/lib/api/platformDashboard";
import { getDashboardStats } from "@/lib/api/platformDashboard";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * §5.29 sous-lot 7 (dernier de §5.29) — tableau de bord global. Volontairement
 * minimal (3 agrégats simples, organisations mises en avant avec leur répartition active/suspendue) : c'est ce qui était retenu au périmètre validé,
 * pas un système de reporting.
 */
function SecondaryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-6 rounded-lg border border-border bg-surface p-6 shadow-flat">
      <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <div>
        <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-ink">
          {formatCount(value)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}

/** Carte entière cliquable vers la liste correspondante. */
function LinkStat({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-6 rounded-lg border border-border bg-surface p-6 shadow-flat transition-colors hover:border-forest-600 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      <p className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-ink-muted">
        {label}
        <span
          className="text-forest-600 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        >
          →
        </span>
      </p>
      <div>
        <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-ink">
          {formatCount(value)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{detail}</p>
      </div>
    </Link>
  );
}

function OrganizationsStat({
  total,
  active,
  suspended,
}: Omit<PlatformDashboardStatsDTO["organizations"], "deleted">) {
  const activeShare = total > 0 ? (active / total) * 100 : 0;
  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-flat lg:col-span-2 lg:row-span-2">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          Organisations
        </p>
        <Link
          href="/platform/organizations"
          className="text-sm font-medium text-forest-600 hover:underline"
        >
          Voir la liste →
        </Link>
      </div>
      <p className="mt-6 font-display text-6xl font-bold tabular-nums tracking-tight text-ink">
        {formatCount(total)}
      </p>

      <div className="mt-8 space-y-4">
        <div
          className="flex h-2 overflow-hidden rounded-sm bg-status-danger/25"
          aria-hidden
        >
          <div className="bg-forest-600" style={{ width: `${activeShare}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="flex items-center gap-2 text-sm text-ink-muted">
              <span
                className="h-2 w-2 rounded-full bg-forest-600"
                aria-hidden
              />
              Active{active > 1 ? "s" : ""}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">
              {formatCount(active)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-sm text-ink-muted">
              <span
                className="h-2 w-2 rounded-full bg-status-danger"
                aria-hidden
              />
              Suspendue{suspended > 1 ? "s" : ""}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">
              {formatCount(suspended)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
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
    <PlatformPage>
      <PlatformPageHeader
        title={`Bienvenue, ${platformAdmin?.name ?? platformAdmin?.email ?? ""}`}
        description="Vue d'ensemble de toutes les organisations hébergées sur CLIENTIA."
      />

      {error ? (
        <PlatformNotice tone="danger">{error}</PlatformNotice>
      ) : isLoading || !stats ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <OrganizationsStat {...stats.organizations} />
            <SecondaryStat
              label="Utilisateurs"
              value={stats.users.total}
              detail="dans les organisations actives"
            />
            <SecondaryStat
              label="Appels traités"
              value={stats.calls.total}
              detail="dans les organisations actives"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SecondaryStat
              label="Utilisateurs connectés"
              value={stats.users.connected}
              detail="Connectés dans les 15 dernières minutes"
            />
            <LinkStat
              href="/platform/organizations?statut=suspendues"
              label="Organisations suspendues"
              value={stats.organizations.suspended}
              detail="accès coupé, réactivables"
            />
            <LinkStat
              href="/platform/organizations/deleted"
              label="Organisations supprimées"
              value={stats.organizations.deleted}
              detail="lecture seule, données conservées"
            />
          </div>
        </div>
      )}
    </PlatformPage>
  );
}
