"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationUserDTO } from "@/lib/api/platformOrganizations";
import { getOrganization, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Détail en lecture seule pour les utilisateurs — la gestion fine reste l'écran
 * /admin/users de l'organisation elle-même (§2.2), pas une deuxième porte d'entrée
 * qui le dupliquerait. Suspendre/réactiver (§5.29 sous-lot 6), en revanche, est
 * bien à sa place ici : c'est une action sur l'ORGANISATION, pas sur un utilisateur.
 */
export default function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authedFetch } = usePlatformAuth();

  const [organization, setOrganization] = useState<PlatformOrganizationDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

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

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-8">
      <Link href="/platform/organizations" className="text-sm text-forest-600 hover:underline">
        ← Toutes les organisations
      </Link>

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

      {isLoading || !organization ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <>
          <header className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Console Super Admin</p>
              <h1 className="font-display text-2xl font-bold text-ink">{organization.name}</h1>
              <p className="font-mono text-xs text-ink-faint">{organization.slug}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge
                label={organization.isActive ? "Active" : "Suspendue"}
                color={organization.isActive ? "var(--color-forest-600)" : "var(--color-status-danger)"}
              />
              <Button
                variant={organization.isActive ? "danger" : "secondary"}
                size="sm"
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
              >
                {organization.isActive ? "Suspendre" : "Réactiver"}
              </Button>
            </div>
          </header>

          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-muted shadow-flat">
            Créée le {new Date(organization.createdAt).toLocaleDateString("fr-FR")} — {organization._count.users}{" "}
            utilisateur{organization._count.users > 1 ? "s" : ""}.
          </div>

          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">Utilisateurs</h2>
            <AdminTable
              columns={columns}
              rows={organization.users}
              rowKey={(u) => u.id}
              isLoading={false}
              emptyMessage="Aucun utilisateur."
            />
          </div>
        </>
      )}
    </div>
  );
}
