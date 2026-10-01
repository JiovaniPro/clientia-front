"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeleteOrganizationModal } from "@/components/platform/DeleteOrganizationModal";
import { formatDate, PlatformNotice, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationUserDTO } from "@/lib/api/platformOrganizations";
import { deleteOrganization, getOrganization, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

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
  const { authedFetch } = usePlatformAuth();

  const [organization, setOrganization] = useState<PlatformOrganizationDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOrganization(await authedFetch((token) => getOrganization(id, token)));
    } catch {
      setError("Impossible de charger cette organisation.");
    } finally {
      setIsLoading(false);
    }
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
    if (organization?.isActive) {
      setShowSuspendConfirm(true);
    } else {
      handleToggleStatus();
    }
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
      header: "Nom",
      className: "text-ink",
      cell: (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
    },
    { header: "E-mail", className: "text-ink-muted", cell: (u) => u.email },
    { header: "Rôle", className: "text-ink-muted", cell: (u) => u.role.name },
    {
      header: "Statut",
      cell: (u) => (
        <StatusBadge
          label={u.isActive ? "Actif" : "Inactif"}
          color={u.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"}
        />
      ),
    },
  ];

  const isDeleted = Boolean(organization?.deletedAt);

  return (
    <PlatformPage>
      <Link
        href={isDeleted ? "/platform/organizations/deleted" : "/platform/organizations"}
        className="inline-block text-sm text-ink-muted hover:text-ink hover:underline"
      >
        ← {isDeleted ? "Organisations supprimées" : "Toutes les organisations"}
      </Link>

      {notice ? <PlatformNotice tone="success">{notice}</PlatformNotice> : null}
      {error ? <PlatformNotice tone="danger">{error}</PlatformNotice> : null}

      {isLoading || !organization ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <>
          <PlatformPageHeader
            eyebrow={isDeleted ? "Organisation supprimée · lecture seule" : "Organisation"}
            title={organization.name}
            description={<span className="font-mono text-xs text-ink-faint">{organization.slug}</span>}
            actions={
              isDeleted ? null : (
                <Button
                  variant={organization.isActive ? "danger" : "secondary"}
                  size="sm"
                  onClick={handleToggleStatusClick}
                  disabled={isTogglingStatus}
                >
                  {organization.isActive ? "Suspendre" : "Réactiver"}
                </Button>
              )
            }
          />

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-flat sm:grid-cols-4">
            <div className="bg-surface p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-muted">Statut</dt>
              <dd className="mt-2">
                <StatusBadge
                  label={isDeleted ? "Supprimée" : organization.isActive ? "Active" : "Suspendue"}
                  color={
                    isDeleted
                      ? "var(--color-ink-faint)"
                      : organization.isActive
                        ? "var(--color-forest-600)"
                        : "var(--color-status-danger)"
                  }
                />
              </dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-muted">Utilisateurs</dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{organization._count.users}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-muted">Créée le</dt>
              <dd className="mt-2 text-sm text-ink">{formatDate(organization.createdAt)}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                {isDeleted ? "Supprimée le" : "Espace de travail"}
              </dt>
              <dd className="mt-2 truncate text-sm text-ink">
                {organization.deletedAt ? (
                  formatDate(organization.deletedAt)
                ) : (
                  <span className="font-mono">{organization.slug}</span>
                )}
              </dd>
            </div>
          </dl>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink">Utilisateurs</h2>
            <AdminTable
              columns={columns}
              rows={organization.users}
              rowKey={(u) => u.id}
              isLoading={false}
              emptyMessage="Aucun utilisateur."
            />
          </section>

          {isDeleted ? null : (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-status-danger/30 p-5">
              <div className="space-y-1">
                <h2 className="font-display text-base font-semibold text-ink">Supprimer l&apos;organisation</h2>
                <p className="text-sm text-ink-muted">
                  {organization.isActive
                    ? "Suspendez d'abord l'organisation : seule une organisation suspendue peut être supprimée."
                    : "Accès coupé définitivement et organisation retirée de la console. Les données sont conservées."}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={organization.isActive}
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
              >
                Supprimer
              </Button>
            </section>
          )}
        </>
      )}

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
