"use client";

import { Archive } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeleteOrganizationModal } from "@/components/platform/DeleteOrganizationModal";
import {
  formatDate,
  organizationState,
  OrganizationStatusBadge,
  plural,
  PlatformNotice,
  PlatformPage,
  PlatformPageHeader,
} from "@/components/platform/PlatformPage";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadError } from "@/components/ui/ListStates";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationUserDTO } from "@/lib/api/platformOrganizations";
import { deleteOrganization, getOrganization, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

function HeaderSkeleton() {
  return (
    <div role="status" aria-label="Chargement…" className="space-y-3">
      <div className="h-4 w-40 animate-pulse rounded-sm bg-surface-subtle" />
      <div className="h-8 w-72 animate-pulse rounded-sm bg-surface-subtle" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-subtle" />
    </div>
  );
}

/**
 * Détail en lecture seule pour les utilisateurs — la gestion fine reste l'écran
 * /admin/users de l'organisation elle-même (§2.2), pas une deuxième porte d'entrée
 * qui le dupliquerait. Suspendre/réactiver (§5.29 sous-lot 6), en revanche, est
 * bien à sa place ici : c'est une action sur l'ORGANISATION, pas sur un utilisateur.
 * Supprimer (suppression douce) n'est possible qu'une fois suspendue ; une organisation
 * supprimée s'affiche ici en lecture seule, sans aucune action.
 */
export default function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const justCreated = useSearchParams().get("cree") === "1";
  const { authedFetch } = usePlatformAuth();

  const [organization, setOrganization] = useState<PlatformOrganizationDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await authedFetch((token) => getOrganization(id, token));
      setOrganization(loaded);
      if (justCreated) {
        setNotice(`Organisation créée — invitation envoyée à ${loaded.users[0]?.email ?? "l'administrateur"}.`);
        // Le message ne doit pas réapparaître au rechargement de la page.
        router.replace(`/platform/organizations/${id}`, { scroll: false });
      }
    } catch {
      setLoadError("Impossible de charger cette organisation.");
    } finally {
      setIsLoading(false);
    }
    // `justCreated` n'est lu qu'au premier chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, id]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  async function handleToggleStatus() {
    if (!organization) return;
    setError(null);
    setNotice(null);
    setIsTogglingStatus(true);
    try {
      const updated = await authedFetch((token) => setOrganizationStatus(organization.id, !organization.isActive, token));
      setOrganization(updated);
      setNotice(
        updated.isActive
          ? "Organisation réactivée — accès restauré immédiatement."
          : "Organisation suspendue — accès coupé et sessions actives révoquées immédiatement.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsTogglingStatus(false);
      setShowSuspendConfirm(false);
    }
  }

  /** Seule la suspension passe par une confirmation — réactiver n'a rien de sensible (§6.27). */
  function handleToggleStatusClick() {
    if (organization?.isActive) setShowSuspendConfirm(true);
    else handleToggleStatus();
  }

  async function handleDelete(confirmName: string) {
    if (!organization) return;
    setDeleteError(null);
    setNotice(null);
    setIsDeleting(true);
    try {
      setOrganization(await authedFetch((token) => deleteOrganization(organization.id, confirmName, token)));
      setShowDeleteModal(false);
      setNotice("Organisation supprimée — plus aucun accès possible, données conservées.");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: AdminTableColumn<PlatformOrganizationUserDTO>[] = [
    {
      header: "Utilisateur",
      cell: (u) => {
        const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
        return (
          <div className="min-w-0 py-0.5">
            <p className="font-medium text-ink">{fullName || u.email}</p>
            {fullName ? <p className="truncate text-xs text-ink-muted">{u.email}</p> : null}
          </div>
        );
      },
    },
    { header: "Rôle", className: "text-ink-muted", cell: (u) => u.role.name },
    {
      header: "Statut",
      cell: (u) => (
        <StatusBadge label={u.isActive ? "Actif" : "Désactivé"} color={u.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"} />
      ),
    },
  ];

  const state = organization ? organizationState(organization) : null;
  const isDeleted = state === "deleted";
  const activeUsers = organization?.users.filter((u) => u.isActive).length ?? 0;
  const crumbs = isDeleted
    ? [
        { href: "/platform/organizations", label: "Organisations" },
        { href: "/platform/organizations/deleted", label: "Supprimées" },
      ]
    : [{ href: "/platform/organizations", label: "Organisations" }];

  return (
    <PlatformPage>
      {loadError ? (
        <>
          <PlatformPageHeader crumbs={[{ href: "/platform/organizations", label: "Organisations" }]} title="Organisation" />
          <div className="rounded-lg border border-border bg-surface">
            <LoadError message={loadError} onRetry={fetchOrganization} />
          </div>
        </>
      ) : isLoading && !organization ? (
        <HeaderSkeleton />
      ) : organization && state ? (
        <>
          <PlatformPageHeader
            crumbs={crumbs}
            title={organization.name}
            badge={<OrganizationStatusBadge state={state} />}
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs">{organization.slug}</span>
                <span aria-hidden>·</span>
                <span>Créée le {formatDate(organization.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>
                  {plural(organization._count.users, "utilisateur", "utilisateurs", "aucun utilisateur")}
                  {organization._count.users > 0 && activeUsers !== organization._count.users ? ` (${activeUsers} actif${activeUsers > 1 ? "s" : ""})` : ""}
                </span>
              </span>
            }
            actions={
              isDeleted ? null : (
                <Button
                  variant={organization.isActive ? "secondary" : "primary"}
                  className={organization.isActive ? "text-status-danger hover:text-status-danger" : undefined}
                  onClick={handleToggleStatusClick}
                  disabled={isTogglingStatus}
                  aria-busy={isTogglingStatus}
                >
                  {organization.isActive ? "Suspendre" : isTogglingStatus ? "Réactivation…" : "Réactiver"}
                </Button>
              )
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

          {isDeleted && organization.deletedAt ? (
            <p className="flex items-start gap-2.5 rounded-md border border-border bg-surface-subtle px-3.5 py-2.5 text-sm text-ink">
              <Archive size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
              Supprimée le {formatDate(organization.deletedAt)} — lecture seule. Plus aucune connexion possible ; les données
              sont conservées.
            </p>
          ) : !organization.isActive ? (
            <p className="flex items-start gap-2.5 rounded-md border border-status-danger/35 bg-status-danger/10 px-3.5 py-2.5 text-sm text-ink">
              Accès suspendu : aucun utilisateur de cette organisation ne peut se connecter. Réactivez-la pour rétablir l&apos;accès,
              ou supprimez-la en bas de page.
            </p>
          ) : null}

          <section aria-labelledby="users-title" className="space-y-3">
            <h2 id="users-title" className="text-base font-semibold text-ink">
              Utilisateurs
            </h2>
            <AdminTable
              columns={columns}
              rows={organization.users}
              rowKey={(u) => u.id}
              isLoading={false}
              emptyMessage="Aucun utilisateur dans cette organisation."
            />
            <p className="text-xs text-ink-muted">
              Lecture seule : les comptes se gèrent depuis l&apos;écran Utilisateurs de l&apos;organisation elle-même.
            </p>
          </section>

          {isDeleted ? null : (
            <section aria-labelledby="danger-title" className="rounded-lg border border-status-danger/35 bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="max-w-xl space-y-1">
                  <h2 id="danger-title" className="text-base font-semibold text-ink">
                    Supprimer l&apos;organisation
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {organization.isActive
                      ? "Suspendez d'abord l'organisation : seule une organisation suspendue peut être supprimée."
                      : "Accès coupé définitivement et organisation retirée de la console. Les données sont conservées et restent consultables dans « Supprimées »."}
                  </p>
                </div>
                <Button
                  variant="danger"
                  disabled={organization.isActive}
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </section>
          )}
        </>
      ) : null}

      {showSuspendConfirm && organization ? (
        <ConfirmModal
          title="Suspendre cette organisation"
          message={`Suspendre « ${organization.name} » ? ${organization._count.users} utilisateur${organization._count.users > 1 ? "s" : ""} actif${organization._count.users > 1 ? "s" : ""} ${organization._count.users > 1 ? "perdront" : "perdra"} l'accès immédiatement et leurs sessions en cours seront révoquées.`}
          confirmLabel="Suspendre"
          onConfirm={handleToggleStatus}
          onClose={() => setShowSuspendConfirm(false)}
          isConfirming={isTogglingStatus}
        />
      ) : null}

      {showDeleteModal && organization ? (
        <DeleteOrganizationModal
          organizationName={organization.name}
          userCount={organization._count.users}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
          isConfirming={isDeleting}
          error={deleteError}
        />
      ) : null}
    </PlatformPage>
  );
}
