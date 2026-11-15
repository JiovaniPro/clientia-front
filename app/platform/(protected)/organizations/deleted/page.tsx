"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatCount, formatDate, plural, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import type { PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { listDeletedOrganizations } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Organisations supprimées (suppression douce) — consultation seule, pour qu'une suppression
 * ne soit jamais invisible après coup. Pas de restauration (non construite). Les plus récentes d'abord.
 */
export default function PlatformDeletedOrganizationsPage() {
  const { authedFetch } = usePlatformAuth();
  const router = useRouter();

  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setOrganizations(await authedFetch((token) => listDeletedOrganizations(token)));
    } catch {
      setLoadError("Impossible de charger les organisations supprimées.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const rows = [...organizations].sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));

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
    { header: "Utilisateurs", className: "text-right tabular-nums text-ink", cell: (org) => formatCount(org._count.users) },
    { header: "Créée le", className: "hidden whitespace-nowrap text-ink-muted sm:table-cell", cell: (org) => formatDate(org.createdAt) },
    {
      header: "Supprimée le",
      className: "whitespace-nowrap text-ink",
      cell: (org) => (org.deletedAt ? formatDate(org.deletedAt) : "—"),
    },
  ];

  return (
    <PlatformPage>
      <PlatformPageHeader
        crumbs={[{ href: "/platform/organizations", label: "Organisations" }]}
        title="Organisations supprimées"
        description={
          isLoading && organizations.length === 0
            ? "Chargement…"
            : `${plural(organizations.length, "organisation supprimée", "organisations supprimées", "Aucune organisation supprimée")} · lecture seule, aucune connexion possible, données conservées.`
        }
      />

      {loadError ? (
        <div className="rounded-lg border border-border bg-surface">
          <LoadError message={loadError} onRetry={fetchAll} />
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          rowKey={(org) => org.id}
          isLoading={isLoading}
          onRowClick={(org) => router.push(`/platform/organizations/${org.id}`)}
          emptyMessage={
            <EmptyState
              title="Aucune organisation supprimée"
              description="Une organisation supprimée depuis sa fiche apparaît ici, en lecture seule, avec sa date de suppression."
            />
          }
        />
      )}
    </PlatformPage>
  );
}
