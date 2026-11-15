"use client";

import { Archive, ArrowRight, Building2, Plus, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrganizationFormModal } from "@/components/platform/OrganizationFormModal";
import {
  formatCount,
  formatDate,
  OrganizationStatusBadge,
  plural,
  PlatformNotice,
  PlatformPage,
  PlatformPageHeader,
} from "@/components/platform/PlatformPage";
import { Kbd, useShortcut } from "@/components/platform/useShortcut";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { PlatformDashboardStatsDTO } from "@/lib/api/platformDashboard";
import { getDashboardStats } from "@/lib/api/platformDashboard";
import type { PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { listOrganizations, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { cn } from "@/lib/cn";

const RECENT_COUNT = 5;

const SEGMENTS = [
  { key: "active", label: "Actives", href: "/platform/organizations?statut=actives", bar: "bg-forest-600", dot: "bg-forest-600" },
  { key: "suspended", label: "Suspendues", href: "/platform/organizations?statut=suspendues", bar: "bg-status-danger", dot: "bg-status-danger" },
  { key: "deleted", label: "Supprimées", href: "/platform/organizations/deleted", bar: "bg-ink-faint/60", dot: "bg-ink-faint" },
] as const;

/**
 * Répartition des organisations : une barre proportionnelle (survol = détail) et une légende cliquable vers
 * chaque liste. La barre est décorative pour les lecteurs d'écran : la légende porte les mêmes chiffres en texte.
 */
function OrganizationsBreakdown({ counts }: { counts: PlatformDashboardStatsDTO["organizations"] }) {
  const values = { active: counts.active, suspended: counts.suspended, deleted: counts.deleted };
  // Les supprimées ne sont plus hébergées : la barre ne montre que la répartition actives / suspendues.
  const hosted = counts.active + counts.suspended;
  return (
    <section aria-labelledby="breakdown-title" className="rounded-lg border border-border bg-surface p-5 shadow-flat">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="breakdown-title" className="text-base font-semibold text-ink">
          Organisations
        </h2>
        <p className="text-sm text-ink-muted">
          {plural(hosted, "hébergée", "hébergées", "aucune hébergée")}
        </p>
      </div>

      <div aria-hidden className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-subtle">
        {hosted > 0
          ? SEGMENTS.filter((s) => s.key !== "deleted" && values[s.key] > 0).map((s) => (
              <div
                key={s.key}
                title={`${s.label} : ${values[s.key]}`}
                className={cn("h-full transition-[filter] duration-150 hover:brightness-110", s.bar)}
                style={{ width: `${(values[s.key] / hosted) * 100}%` }}
              />
            ))
          : null}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SEGMENTS.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="group flex items-center gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:border-ink-faint hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />
              <span className="min-w-0 flex-1 text-sm text-ink-muted">{s.label}</span>
              <span className="text-lg font-semibold tabular-nums text-ink">{formatCount(values[s.key])}</span>
              <ArrowRight
                size={14}
                aria-hidden
                className="shrink-0 text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-forest-600 motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ label, value, detail, live = false }: { label: string; value: number; detail: string; live?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          {live ? (
            <span aria-hidden className="relative flex h-2 w-2">
              {value > 0 ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-600/60 motion-reduce:hidden" /> : null}
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", value > 0 ? "bg-forest-600" : "bg-ink-faint")} />
            </span>
          ) : null}
          {label}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-ink">{formatCount(value)}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, hint, onClick, href }: { icon: LucideIcon; label: string; hint?: string; onClick?: () => void; href?: string }) {
  const className =
    "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600";
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink-muted transition-colors group-hover:border-forest-600/40 group-hover:text-forest-600">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {hint ? <Kbd className="text-ink-muted">{hint}</Kbd> : null}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Chargement…" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-lg bg-surface-subtle" />
        <div className="h-64 animate-pulse rounded-lg bg-surface-subtle" />
      </div>
      <div className="space-y-6">
        <div className="h-52 animate-pulse rounded-lg bg-surface-subtle" />
        <div className="h-44 animate-pulse rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}

/**
 * Accueil de la console — orienté action. Colonne principale : répartition des organisations, organisations
 * suspendues à vérifier, dernières créées. Colonne latérale : activité de la plateforme et actions rapides.
 * Les agrégats restent ceux du périmètre validé (§5.29 sous-lot 7). Raccourci : N = nouvelle organisation.
 */
export default function PlatformHomePage() {
  const { platformAdmin, authedFetch } = usePlatformAuth();
  const router = useRouter();

  const [stats, setStats] = useState<PlatformDashboardStatsDTO | null>(null);
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextStats, nextOrganizations] = await Promise.all([
        authedFetch((token) => getDashboardStats(token)),
        authedFetch((token) => listOrganizations(token)),
      ]);
      setStats(nextStats);
      setOrganizations(nextOrganizations);
    } catch {
      setLoadError("Impossible de charger l'accueil de la console.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useShortcut("n", () => setIsCreating(true));

  async function reactivate(org: PlatformOrganizationSummaryDTO) {
    setNotice(null);
    setActionError(null);
    setPendingId(org.id);
    try {
      await authedFetch((token) => setOrganizationStatus(org.id, true, token));
      setNotice(`« ${org.name} » réactivée — accès restauré immédiatement.`);
      await fetchAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  const suspended = organizations.filter((o) => !o.isActive);
  const recent = [...organizations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_COUNT);
  const firstName = platformAdmin?.name?.trim().split(/\s+/)[0];

  const recentColumns: AdminTableColumn<PlatformOrganizationSummaryDTO>[] = [
    {
      header: "Organisation",
      cell: (org) => (
        <div className="min-w-0 py-0.5">
          <Link
            href={`/platform/organizations/${org.id}`}
            className="font-medium text-ink underline-offset-2 hover:text-forest-600 hover:underline"
          >
            {org.name}
          </Link>
          <p className="truncate font-mono text-xs text-ink-muted">{org.slug}</p>
        </div>
      ),
    },
    { header: "Statut", cell: (org) => <OrganizationStatusBadge state={org.isActive ? "active" : "suspended"} /> },
    { header: "Utilisateurs", className: "text-right tabular-nums text-ink", cell: (org) => formatCount(org._count.users) },
    { header: "Créée le", className: "whitespace-nowrap text-right text-ink-muted", cell: (org) => formatDate(org.createdAt) },
  ];

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={firstName ? `Bonjour, ${firstName}` : "Accueil"}
        description="Organisations hébergées sur CLIENTIA : création, suspension et suivi."
        actions={
          <Button onClick={() => setIsCreating(true)} aria-keyshortcuts="N">
            <Plus size={16} aria-hidden />
            Nouvelle organisation
            <Kbd className="ml-1 hidden sm:inline-flex">N</Kbd>
          </Button>
        }
      />

      {notice ? (
        <PlatformNotice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </PlatformNotice>
      ) : null}
      {actionError ? (
        <PlatformNotice tone="danger" onDismiss={() => setActionError(null)}>
          {actionError}
        </PlatformNotice>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-border bg-surface">
          <LoadError message={loadError} onRetry={fetchAll} />
        </div>
      ) : isLoading && !stats ? (
        <DashboardSkeleton />
      ) : stats ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <OrganizationsBreakdown counts={stats.organizations} />

            {suspended.length > 0 ? (
              <section aria-labelledby="suspended-title" className="space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id="suspended-title" className="text-base font-semibold text-ink">
                    À vérifier{" "}
                    <span className="font-normal text-ink-muted">· {plural(suspended.length, "organisation suspendue", "organisations suspendues")}</span>
                  </h2>
                  <Link href="/platform/organizations?statut=suspendues" className="text-sm font-medium text-forest-600 hover:underline">
                    Tout voir
                  </Link>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-flat">
                  {suspended.slice(0, RECENT_COUNT).map((org) => (
                    <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-status-danger" />
                        <div className="min-w-0">
                          <Link
                            href={`/platform/organizations/${org.id}`}
                            className="font-medium text-ink underline-offset-2 hover:text-forest-600 hover:underline"
                          >
                            {org.name}
                          </Link>
                          <p className="text-xs text-ink-muted">
                            Accès coupé · {plural(org._count.users, "utilisateur", "utilisateurs", "aucun utilisateur")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => reactivate(org)}
                          disabled={pendingId !== null}
                          aria-busy={pendingId === org.id}
                        >
                          {pendingId === org.id ? "Réactivation…" : "Réactiver"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => router.push(`/platform/organizations?statut=suspendues&org=${org.id}`)}>
                          Ouvrir
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="recent-title" className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="recent-title" className="text-base font-semibold text-ink">
                  Dernières organisations créées
                </h2>
                <Link href="/platform/organizations" className="text-sm font-medium text-forest-600 hover:underline">
                  Toutes les organisations
                </Link>
              </div>
              <AdminTable
                columns={recentColumns}
                rows={recent}
                rowKey={(org) => org.id}
                isLoading={isLoading}
                onRowClick={(org) => router.push(`/platform/organizations?org=${org.id}`)}
                emptyMessage={
                  <EmptyState
                    title="Aucune organisation pour l'instant"
                    description="Créez la première : son administrateur recevra une invitation par e-mail pour définir son mot de passe."
                    action={
                      <Button size="sm" onClick={() => setIsCreating(true)}>
                        <Plus size={14} aria-hidden />
                        Nouvelle organisation
                      </Button>
                    }
                  />
                }
              />
            </section>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6">
            <section aria-labelledby="activity-title" className="rounded-lg border border-border bg-surface p-5 shadow-flat">
              <h2 id="activity-title" className="mb-3 text-base font-semibold text-ink">
                Activité
              </h2>
              <div className="divide-y divide-border">
                <ActivityRow label="Connectés" value={stats.users.connected} detail="Connectés dans les 15 dernières minutes" live />
                <ActivityRow label="Utilisateurs" value={stats.users.total} detail="dans les organisations actives" />
                <ActivityRow label="Appels traités" value={stats.calls.total} detail="dans les organisations actives" />
              </div>
            </section>

            <section aria-labelledby="quick-title" className="rounded-lg border border-border bg-surface p-2 shadow-flat">
              <h2 id="quick-title" className="px-3 pb-1 pt-2 text-sm font-semibold text-ink">
                Actions rapides
              </h2>
              <QuickAction icon={Plus} label="Nouvelle organisation" hint="N" onClick={() => setIsCreating(true)} />
              <QuickAction icon={Search} label="Rechercher une organisation" href="/platform/organizations?recherche=1" />
              <QuickAction icon={Building2} label="Toutes les organisations" href="/platform/organizations" />
              <QuickAction icon={Archive} label="Organisations supprimées" href="/platform/organizations/deleted" />
            </section>
          </div>
        </div>
      ) : null}

      {isCreating ? (
        <OrganizationFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(created) => {
            setIsCreating(false);
            router.push(`/platform/organizations/${created.id}?cree=1`);
          }}
        />
      ) : null}
    </PlatformPage>
  );
}
