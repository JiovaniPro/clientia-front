"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleFormModal } from "@/components/admin/RoleFormModal";
import type { PermissionDTO, RoleDetailDTO } from "@/lib/api/roles";
import { deleteRole, listPermissionsCatalog, listRolesDetailed } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Écran d'administration §5.21 — rôles et permissions. Cœur du système dynamique
 * (§P0.0) : les permissions ne sont jamais codées en dur côté écran, elles sont
 * lues depuis le catalogue global (`GET /roles/permissions-catalog`).
 */
export default function AdminRolesPage() {
  const { authedFetch } = useAuth();

  const [roles, setRoles] = useState<RoleDetailDTO[]>([]);
  const [catalog, setCatalog] = useState<PermissionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; role: RoleDetailDTO } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesData, catalogData] = await Promise.all([
        authedFetch((token) => listRolesDetailed(token)),
        authedFetch((token) => listPermissionsCatalog(token)),
      ]);
      setRoles(rolesData);
      setCatalog(catalogData);
    } catch {
      setError("Impossible de charger les rôles.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleSaved(saved: RoleDetailDTO) {
    setModal(null);
    setNotice(modal?.mode === "create" ? `Rôle « ${saved.name} » créé.` : "Rôle mis à jour.");
    setRoles((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
    });
  }

  async function handleDelete(role: RoleDetailDTO) {
    setError(null);
    setNotice(null);
    setPendingDeleteId(role.id);
    try {
      await authedFetch((token) => deleteRole(role.id, token));
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      setNotice(`Rôle « ${role.name} » supprimé.`);
    } catch (err) {
      // Les deux garde-fous backend (rôle système, rôle encore assigné) sont
      // affichés tels quels — jamais re-devinés côté client.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
          <h1 className="font-display text-2xl font-bold text-ink">Rôles &amp; permissions</h1>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Nouveau rôle</Button>
      </header>

      {notice ? (
        <p className="rounded-md border border-forest-600/30 bg-forest-600/10 px-3 py-2 text-sm text-forest-600">
          {notice}
        </p>
      ) : null}
      {error ? <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">{error}</p> : null}

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : roles.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucun rôle.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Rôle</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Permissions</th>
                <th className="px-4 py-2.5 font-medium">Utilisateurs</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const isPendingDelete = pendingDeleteId === r.id;
                const canDelete = !r.isSystem && r._count.users === 0;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                    <td className="px-4 py-2.5 text-ink">
                      <StatusBadge label={r.name} color={r.color} />
                      {r.isSystem ? <span className="ml-1.5 text-xs text-ink-faint">(système)</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{r.description ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{r.permissions.length}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{r._count.users}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="text-xs font-medium text-forest-600 hover:underline"
                          onClick={() => setModal({ mode: "edit", role: r })}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
                          onClick={() => handleDelete(r)}
                          disabled={isPendingDelete || !canDelete}
                          title={
                            r.isSystem
                              ? "Les rôles système ne peuvent pas être supprimés"
                              : r._count.users > 0
                                ? "Ce rôle est encore assigné à des utilisateurs"
                                : undefined
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal ? (
        <RoleFormModal
          role={modal.mode === "edit" ? modal.role : undefined}
          permissionsCatalog={catalog}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
