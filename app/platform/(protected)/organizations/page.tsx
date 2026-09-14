"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrganizationFormModal } from "@/components/platform/OrganizationFormModal";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { listOrganizations, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * §5.29 sous-lot 5 + 6 — liste, création, et maintenant suspendre/réactiver.
 * Suspendre coupe l'accès immédiatement (sessions actives révoquées côté backend,
 * message explicite affiché aux utilisateurs de l'organisation à leur prochain
 * appel API) ; réactiver restaure l'accès sans rien reconstruire.
 */
export default function PlatformOrganizationsPage() {
  const { authedFetch } = usePlatformAuth();

  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
    setNotice(`« ${created.name} » créée.`);
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
    }
  }

  const columns: AdminTableColumn<PlatformOrganizationSummaryDTO>[] = [
    {
      header: "Organisation",
      className: "text-ink",
      cell: (org) => (
        <Link href={`/platform/organizations/${org.id}`} className="font-medium text-forest-600 hover:underline">
          {org.name}
        </Link>
      ),
    },
    { header: "Espace de travail", className: "font-mono text-xs text-ink-faint", cell: (org) => org.slug },
    { header: "Utilisateurs", className: "text-ink-muted", cell: (org) => org._count.users },
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
      header: "Créée le",
      className: "text-ink-muted",
      cell: (org) => new Date(org.createdAt).toLocaleDateString("fr-FR"),
    },
    {
      header: "",
      className: "text-right",
      cell: (org) => (
        <button
          type="button"
          className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
          onClick={() => handleToggleStatus(org)}
          disabled={pendingId === org.id}
        >
          {org.isActive ? "Suspendre" : "Réactiver"}
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Console Super Admin</p>
          <h1 className="font-display text-2xl font-bold text-ink">Organisations</h1>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>Nouvelle organisation</Button>
      </header>

      {notice ? (
        <p className="rounded-md border border-forest-600/30 bg-forest-600/10 px-3 py-2 text-sm text-forest-600">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <AdminTable
        columns={columns}
        rows={organizations}
        rowKey={(org) => org.id}
        isLoading={isLoading}
        emptyMessage="Aucune organisation."
      />

      {isModalOpen ? <OrganizationFormModal onClose={() => setIsModalOpen(false)} onSaved={handleCreated} /> : null}
    </div>
  );
}
