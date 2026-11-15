"use client";

import { ChevronRight, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeleteOrganizationModal } from "@/components/platform/DeleteOrganizationModal";
import { OrganizationFormModal } from "@/components/platform/OrganizationFormModal";
import { OrganizationPanel } from "@/components/platform/OrganizationPanel";
import { Kbd, useShortcut } from "@/components/platform/useShortcut";
import {
  formatCount,
  formatDate,
  OrganizationStatusBadge,
  plural,
  PlatformNotice,
  PlatformPage,
  PlatformPageHeader,
} from "@/components/platform/PlatformPage";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { deleteOrganization, listOrganizations, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { cn } from "@/lib/cn";

/**
 * §5.29 sous-lot 5 + 6 — liste, création, suspendre/réactiver, supprimer.
 * Suspendre coupe l'accès immédiatement (sessions actives révoquées côté backend,
 * message explicite affiché aux utilisateurs de l'organisation à leur prochain
 * appel API) ; réactiver restaure l'accès sans rien reconstruire.
 *
 * Écrans larges : vue partagée — un clic sur une ligne ouvre la fiche à droite (`?org=<id>`, partageable),
 * sans quitter la liste. Écrans étroits : la ligne mène à la fiche complète. Raccourcis : N (nouvelle
 * organisation), / (recherche), Échap (fermer la fiche).
 */
const WIDE_QUERY = "(min-width: 1024px)";
const STATUS_FILTERS = [
  { value: "toutes", label: "Toutes" },
  { value: "actives", label: "Actives" },
  { value: "suspendues", label: "Suspendues" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

/** Comparaison sans accents ni casse : « Écoute » se trouve avec « ecoute ». */
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PlatformOrganizationsPage() {
  const { authedFetch } = usePlatformAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFilter = searchParams.get("statut");
  const statusFilter: StatusFilter = rawFilter === "actives" || rawFilter === "suspendues" ? rawFilter : "toutes";
  const selectedId = searchParams.get("org");
  const searchRef = useRef<HTMLInputElement>(null);

  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PlatformOrganizationSummaryDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformOrganizationSummaryDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setOrganizations(await authedFetch((token) => listOrganizations(token)));
    } catch {
      setLoadError("Impossible de charger les organisations.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleToggleStatus(org: PlatformOrganizationSummaryDTO) {
    setError(null);
    setNotice(null);
    setPendingId(org.id);
    try {
      const updated = await authedFetch((token) => setOrganizationStatus(org.id, !org.isActive, token));
      setOrganizations((prev) => prev.map((o) => (o.id === updated.id ? { ...o, isActive: updated.isActive } : o)));
      setNotice(
        updated.isActive
          ? `« ${updated.name} » réactivée — accès restauré immédiatement.`
          : `« ${updated.name} » suspendue — accès coupé et sessions actives révoquées immédiatement.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
      setSuspendTarget(null);
    }
  }

  /** Met à jour l'URL en gardant le filtre courant ; `org` null ferme la fiche. */
  function urlWith(org: string | null, statut: StatusFilter = statusFilter) {
    const params = new URLSearchParams();
    if (statut !== "toutes") params.set("statut", statut);
    if (org) params.set("org", org);
    const query = params.toString();
    return `/platform/organizations${query ? `?${query}` : ""}`;
  }

  function openOrganization(org: PlatformOrganizationSummaryDTO) {
    if (typeof window !== "undefined" && window.matchMedia?.(WIDE_QUERY).matches) {
      router.replace(urlWith(org.id), { scroll: false });
    } else {
      router.push(`/platform/organizations/${org.id}`);
    }
  }

  /** Changement venu de la fiche latérale : statut mis à jour, ou organisation supprimée (elle quitte la liste). */
  function handlePanelChange(updated: PlatformOrganizationSummaryDTO) {
    if (updated.deletedAt) {
      setOrganizations((prev) => prev.filter((o) => o.id !== updated.id));
      router.replace(urlWith(null), { scroll: false });
      setNotice(`« ${updated.name} » supprimée — plus aucun accès possible, données conservées.`);
      return;
    }
    setOrganizations((prev) => prev.map((o) => (o.id === updated.id ? { ...o, isActive: updated.isActive } : o)));
  }

  useShortcut("n", () => setIsModalOpen(true));
  useShortcut("/", () => searchRef.current?.focus());
  useShortcut("Escape", () => router.replace(urlWith(null), { scroll: false }), Boolean(selectedId));

  /** Comme sur le détail : seule la suspension passe par une confirmation (§6.27). */
  function handleToggleStatusClick(org: PlatformOrganizationSummaryDTO) {
    if (org.isActive) setSuspendTarget(org);
    else handleToggleStatus(org);
  }

  async function handleDelete(confirmName: string) {
    if (!deleteTarget) return;
    setDeleteError(null);
    setNotice(null);
    setIsDeleting(true);
    try {
      const deleted = await authedFetch((token) => deleteOrganization(deleteTarget.id, confirmName, token));
      // Une organisation supprimée quitte cette liste (elle vit dans /platform/organizations/deleted).
      setOrganizations((prev) => prev.filter((o) => o.id !== deleted.id));
      setDeleteTarget(null);
      setNotice(`« ${deleted.name} » supprimée — plus aucun accès possible, données conservées.`);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsDeleting(false);
    }
  }

  const counts = {
    toutes: organizations.length,
    actives: organizations.filter((o) => o.isActive).length,
    suspendues: organizations.filter((o) => !o.isActive).length,
  };
  const needle = fold(query.trim());
  const visibleOrganizations = organizations.filter(
    (o) =>
      (statusFilter === "actives" ? o.isActive : statusFilter === "suspendues" ? !o.isActive : true) &&
      (!needle || fold(o.name).includes(needle) || o.slug.includes(needle)),
  );

  const columns: AdminTableColumn<PlatformOrganizationSummaryDTO>[] = [
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
    { header: "Créée le", className: "hidden whitespace-nowrap text-ink-muted sm:table-cell", cell: (org) => formatDate(org.createdAt) },
    {
      header: "Actions",
      className: "w-px text-right",
      cell: (org) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={org.isActive ? "hover:text-status-danger" : "text-forest-600 hover:text-forest-700"}
            onClick={() => handleToggleStatusClick(org)}
            disabled={pendingId === org.id}
            aria-busy={pendingId === org.id}
          >
            {org.isActive ? "Suspendre" : "Réactiver"}
          </Button>
          {/* Seule une organisation suspendue peut être supprimée (règle backend). */}
          {org.isActive ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="text-status-danger hover:text-status-danger"
              onClick={() => {
                setDeleteError(null);
                setDeleteTarget(org);
              }}
              disabled={pendingId === org.id}
            >
              Supprimer
            </Button>
          )}
        </div>
      ),
    },
  ];

  const emptyState = needle ? (
    <EmptyState
      title={`Aucune organisation ne correspond à « ${query.trim()} »`}
      description="La recherche porte sur le nom et l'identifiant."
      action={
        <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
          Effacer la recherche
        </Button>
      }
    />
  ) : statusFilter === "suspendues" ? (
    <EmptyState title="Aucune organisation suspendue" description="Toutes les organisations ont accès à CLIENTIA." />
  ) : statusFilter === "actives" ? (
    <EmptyState title="Aucune organisation active" description="Réactivez une organisation suspendue ou créez-en une nouvelle." />
  ) : (
    <EmptyState
      title="Aucune organisation pour l'instant"
      description="Créez la première : son administrateur recevra une invitation par e-mail pour définir son mot de passe."
      action={
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={14} aria-hidden />
          Nouvelle organisation
        </Button>
      }
    />
  );

  return (
    <PlatformPage>
      <PlatformPageHeader
        title="Organisations"
        description={
          isLoading && organizations.length === 0
            ? "Chargement…"
            : `${plural(counts.toutes, "organisation")} · ${plural(counts.actives, "active")} · ${plural(counts.suspendues, "suspendue")}`
        }
        actions={
          <Button onClick={() => setIsModalOpen(true)} aria-keyshortcuts="N">
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
      {error ? (
        <PlatformNotice tone="danger" onDismiss={() => setError(null)}>
          {error}
        </PlatformNotice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrer par statut" className="flex gap-1 rounded-md border border-border bg-surface p-1">
          {STATUS_FILTERS.map((filter) => {
            const isCurrent = statusFilter === filter.value;
            return (
              <Link
                key={filter.value}
                href={urlWith(selectedId, filter.value)}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                  isCurrent ? "bg-forest-50 text-forest-600" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                )}
              >
                {filter.label}
                <span aria-hidden className={cn("tabular-nums text-xs", isCurrent ? "text-forest-600" : "text-ink-faint")}>
                  {isLoading && organizations.length === 0 ? "–" : counts[filter.value]}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="relative w-full sm:w-72">
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            ref={searchRef}
            autoFocus={searchParams.get("recherche") === "1"}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Rechercher une organisation"
            aria-label="Rechercher une organisation par nom ou identifiant"
            aria-keyshortcuts="/"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              <X size={14} aria-hidden />
            </button>
          ) : (
            <Kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">/</Kbd>
          )}
        </div>
      </div>

      <div className={cn("grid items-start gap-6", selectedId && "lg:grid-cols-[minmax(0,1fr)_400px]")}>
        <div className="min-w-0">
          {loadError ? (
            <div className="rounded-lg border border-border bg-surface">
              <LoadError message={loadError} onRetry={fetchAll} />
            </div>
          ) : (
            <AdminTable
              columns={columns}
              rows={visibleOrganizations}
              rowKey={(org) => org.id}
              isLoading={isLoading}
              onRowClick={openOrganization}
              rowClassName={(org) => (org.id === selectedId ? "bg-forest-50 hover:bg-forest-50" : undefined)}
              emptyMessage={emptyState}
            />
          )}
          {!isLoading && visibleOrganizations.length > 0 ? (
            <p className="mt-3 hidden text-xs text-ink-muted lg:block">
              Cliquez sur une ligne pour ouvrir sa fiche ici, sans quitter la liste.
            </p>
          ) : null}
        </div>
        {selectedId ? (
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <OrganizationPanel
              key={selectedId}
              organizationId={selectedId}
              onClose={() => router.replace(urlWith(null), { scroll: false })}
              onChanged={handlePanelChange}
            />
          </div>
        ) : null}
      </div>

      {suspendTarget ? (
        <ConfirmModal
          title="Suspendre cette organisation"
          message={`Suspendre « ${suspendTarget.name} » ? ${suspendTarget._count.users} utilisateur${suspendTarget._count.users > 1 ? "s" : ""} actif${suspendTarget._count.users > 1 ? "s" : ""} ${suspendTarget._count.users > 1 ? "perdront" : "perdra"} l'accès immédiatement et leurs sessions en cours seront révoquées.`}
          confirmLabel="Suspendre"
          onConfirm={() => handleToggleStatus(suspendTarget)}
          onClose={() => setSuspendTarget(null)}
          isConfirming={pendingId === suspendTarget.id}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteOrganizationModal
          organizationName={deleteTarget.name}
          userCount={deleteTarget._count.users}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isConfirming={isDeleting}
          error={deleteError}
        />
      ) : null}

      {isModalOpen ? (
        <OrganizationFormModal
          onClose={() => setIsModalOpen(false)}
          onSaved={(created) => {
            setIsModalOpen(false);
            router.push(`/platform/organizations/${created.id}?cree=1`);
          }}
        />
      ) : null}
    </PlatformPage>
  );
}
