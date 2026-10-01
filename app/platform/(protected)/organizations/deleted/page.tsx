"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDate, PlatformNotice, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import type { PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { listDeletedOrganizations } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Organisations supprimées (suppression douce) — consultation seule, pour qu'une suppression
 * ne soit jamais invisible après coup. Pas de restauration (non construite).
 */
export default function PlatformDeletedOrganizationsPage() {
  const { authedFetch } = usePlatformAuth();

  const [organizations, setOrganizations] = useState<PlatformOrganizationSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOrganizations(await authedFetch((token) => listDeletedOrganizations(token)));
    } catch {
      setError("Impossible de charger les organisations supprimées.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    { header: "Utilisateurs", className: "text-right tabular-nums text-ink", cell: (org) => org._count.users },
    { header: "Créée le", className: "whitespace-nowrap text-ink-muted", cell: (org) => formatDate(org.createdAt) },
    {
      header: "Supprimée le",
      className: "whitespace-nowrap text-ink-muted",
      cell: (org) => (org.deletedAt ? formatDate(org.deletedAt) : "—"),
    },
  ];

  return (
    <PlatformPage>
      <Link href="/platform/organizations" className="inline-block text-sm text-ink-muted hover:text-ink hover:underline">
        ← Toutes les organisations
      </Link>

      <PlatformPageHeader
        title="Organisations supprimées"
        description="Lecture seule. Aucune connexion possible ; les données sont conservées en base."
      />

      {error ? <PlatformNotice tone="danger">{error}</PlatformNotice> : null}

      <AdminTable
        columns={columns}
        rows={organizations}
        rowKey={(org) => org.id}
        isLoading={isLoading}
        emptyMessage="Aucune organisation supprimée."
      />
    </PlatformPage>
  );
}
