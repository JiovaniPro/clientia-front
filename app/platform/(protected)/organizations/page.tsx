"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, PlatformNotice, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
import { DeleteOrganizationModal } from "@/components/platform/DeleteOrganizationModal";
import { OrganizationFormModal } from "@/components/platform/OrganizationFormModal";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { deleteOrganization, listOrganizations, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * §5.29 sous-lot 5 + 6 — liste, création, et maintenant suspendre/réactiver.
 * Suspendre coupe l'accès immédiatement (sessions actives révoquées côté backend,
 * message explicite affiché aux utilisateurs de l'organisation à leur prochain
 * appel API) ; réactiver restaure l'accès sans rien reconstruire.
 */
const STATUS_FILTERS = [
  { value: "toutes", label: "Toutes" },
  { value: "actives", label: "Actives" },
  { value: "suspendues", label: "Suspendues" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export default function PlatformOrganizationsPage() {
  const { authedFetch } = usePlatformAuth();

  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PlatformOrganizationSummaryDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformOrganizationSummaryDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const statusFilter = (useSearchParams().get("statut") ?? "toutes") as StatusFilter;

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOrganizations(await authedFetch((token) => listOrganizations(token)));
    } catch {
      setError("Impossible de charger les organisations.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleCreated(created: PlatformOrganizationDetailDTO) {
    setIsModalOpen(false);
    setOrganizations((prev) => [{ ...created, _count: created._count }, ...prev]);
    setNotice(`« ${created.name} » créée — invitation envoyée à ${created.users[0]?.email ?? "l'administrateur"}.`);
  }

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

  /** Comme sur le détail : seule la suspension passe par une confirmation (§6.27). */
  function handleToggleStatusClick(org: PlatformOrganizationSummaryDTO) {
    if (org.isActive) {
      setSuspendTarget(org);
    } else {
      handleToggleStatus(org);
    }
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

  const activeCount = organizations.filter((o) => o.isActive).length;
  const suspendedCount = organizations.length - activeCount;

  const visibleOrganizations = organizations.filter((o) =>
    statusFilter === "actives" ? o.isActive : statusFilter === "suspendues" ? !o.isActive : true,
  );

  const columns: AdminTableColumn<PlatformOrganizationSummaryDTO>[] = [
    {
      header: "Organisation",
      cell: (org) => (
        <div className="min-w-0 py-1">
          <Link
            href={`/platform/organizations/${org.id}`}
            className="font-medium text-ink underline-offset-2 hover:text-forest-600 hover:underline"
          >
            {org.name}
          </Link>
          <p className="truncate font-mono text-xs text-ink-faint">{org.slug}</p>
        </div>
      ),
    },
    {
      header: "Statut",
      cell: (org) => (
        <StatusBadge
          label={org.isActive ? "Active" : "Suspendue"}
          color={org.isActive ? "var(--color-forest-600)" : "var(--color-status-danger)"}
        />
      ),
    },
    {
      header: "Utilisateurs",
      className: "text-right tabular-nums text-ink",
      cell: (org) => org._count.users,
    },
    {
      header: "Créée le",
      className: "whitespace-nowrap text-ink-muted",
      cell: (org) => formatDate(org.createdAt),
    },
    {
      header: "",
      className: "text-right",
      cell: (org) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={org.isActive ? "text-status-danger hover:text-status-danger" : undefined}
            onClick={() => handleToggleStatusClick(org)}
            disabled={pendingId === org.id}
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

  return (
    <PlatformPage>
      <PlatformPageHeader
        title="Organisations"
        description={
          isLoading
            ? "Chargement…"
            : `${organizations.length} organisation${organizations.length > 1 ? "s" : ""} · ${activeCount} active${activeCount > 1 ? "s" : ""} · ${suspendedCount} suspendue${suspendedCount > 1 ? "s" : ""}`
        }
        actions={
          <>
            <Link
              href="/platform/organizations/deleted"
              className="text-sm font-medium text-ink-muted hover:text-ink hover:underline"
            >
              Organisations supprimées
            </Link>
            <Button onClick={() => setIsModalOpen(true)}>Nouvelle organisation</Button>
          </>
        }
      />

      {notice ? <PlatformNotice tone="success">{notice}</PlatformNotice> : null}
      {error ? <PlatformNotice tone="danger">{error}</PlatformNotice> : null}

      <nav aria-label="Filtrer par statut" className="flex w-fit gap-1 rounded-md border border-border bg-surface p-1">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "toutes" ? "/platform/organizations" : `/platform/organizations?statut=${filter.value}`}
            aria-current={statusFilter === filter.value ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.value ? "bg-forest-600 text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <AdminTable
        columns={columns}
        rows={visibleOrganizations}
        rowKey={(org) => org.id}
        isLoading={isLoading}
        emptyMessage={statusFilter === "suspendues" ? "Aucune organisation suspendue." : "Aucune organisation."}
      />

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

      {isModalOpen ? <OrganizationFormModal onClose={() => setIsModalOpen(false)} onSaved={handleCreated} /> : null}
    </PlatformPage>
  );
}
