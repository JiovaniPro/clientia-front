"use client";

import { KeyRound, Lock, Pencil, Plus, Shield, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleFormModal } from "@/components/admin/RoleFormModal";
import { AdminFeedback } from "@/components/admin/kit/Feedback";
import { RowMenu } from "@/components/admin/kit/RowMenu";
import { AdminHeader, StatTile } from "@/components/admin/kit/Controls";
import { Button } from "@/components/ui/Button";
import { clickableRowProps } from "@/components/ui/clickableRow";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { PermissionDTO, RoleDetailDTO } from "@/lib/api/roles";
import { deleteRole, listPermissionsCatalog, listRolesDetailed } from "@/lib/api/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

const FALLBACK_COLOR = "var(--color-forest-600)";
/** Nombre de modules nommés sur une carte avant le « +N ». */
const MODULES_SHOWN = 5;

/** Permissions d'un rôle regroupées par module, du plus fourni au moins fourni. */
function modulesOf(role: RoleDetailDTO) {
  const counts = new Map<string, number>();
  for (const { permission } of role.permissions) counts.set(permission.module, (counts.get(permission.module) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function RoleCard({
  role,
  catalogSize,
  isDeleting,
  onEdit,
  onDelete,
  index,
}: {
  role: RoleDetailDTO;
  catalogSize: number;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const color = role.color ?? FALLBACK_COLOR;
  const modules = modulesOf(role);
  const coverage = catalogSize > 0 ? role.permissions.length / catalogSize : 0;
  const canDelete = !role.isSystem && role._count.users === 0;

  return (
    <article
      {...clickableRowProps(onEdit)}
      aria-label={`Rôle ${role.name}`}
      className="app-rise group flex h-full cursor-pointer flex-col rounded-lg border border-border bg-surface p-5 shadow-flat transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-forest-600 hover:shadow-raised focus-visible:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          <Shield size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-ink">{role.name}</h2>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-muted">
            {role.isSystem ? (
              <>
                <Lock size={11} aria-hidden /> Rôle système
              </>
            ) : (
              "Rôle personnalisé"
            )}
          </p>
        </div>
        <RowMenu
          label={`Actions du rôle ${role.name}`}
          items={[
            { label: "Modifier le rôle", icon: Pencil, onSelect: onEdit },
            {
              label: "Supprimer le rôle",
              icon: Trash2,
              danger: true,
              onSelect: onDelete,
              disabled: isDeleting || !canDelete,
              hint: role.isSystem
                ? "Les rôles système ne peuvent pas être supprimés"
                : role._count.users > 0
                  ? "Ce rôle est encore assigné à des utilisateurs"
                  : undefined,
            },
          ]}
        />
      </div>

      <p className={cn("mt-3 line-clamp-2 min-h-10 text-sm", role.description ? "text-ink-muted" : "text-ink-faint")}>
        {role.description ?? "Aucune description."}
      </p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-ink">
            {role.permissions.length} permission{role.permissions.length > 1 ? "s" : ""}
          </span>
          <span className="font-mono text-ink-faint">sur {catalogSize}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-surface-subtle" aria-hidden>
          <div className="h-full rounded-sm transition-[width] duration-500 ease-out" style={{ width: `${coverage * 100}%`, backgroundColor: color }} />
        </div>
      </div>

      <ul className="mt-3 flex min-h-[3.75rem] flex-wrap content-start gap-1.5" aria-label="Modules couverts">
        {modules.length === 0 ? <li className="text-xs text-ink-faint">Aucun accès.</li> : null}
        {modules.slice(0, MODULES_SHOWN).map(([module, count]) => (
          <li key={module} className="rounded-sm bg-surface-subtle px-2 py-0.5 text-xs text-ink-muted">
            {module} <span className="font-mono text-ink-faint">{count}</span>
          </li>
        ))}
        {modules.length > MODULES_SHOWN ? <li className="px-1 py-0.5 text-xs text-ink-faint">+{modules.length - MODULES_SHOWN}</li> : null}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <Users size={15} aria-hidden />
          {role._count.users} utilisateur{role._count.users > 1 ? "s" : ""}
        </span>
        <span aria-hidden className="text-xs font-medium text-ink-muted transition-colors group-hover:text-forest-600">
          Modifier
        </span>
      </div>
    </article>
  );
}

/**
 * Écran d'administration §5.21 — rôles et permissions. Cœur du système dynamique
 * (§P0.0) : les permissions ne sont jamais codées en dur côté écran, elles sont
 * lues depuis le catalogue global (`GET /roles/permissions-catalog`).
 * Présentation : une carte par rôle (couleur, utilisateurs, couverture des permissions, modules couverts),
 * cliquable pour la modifier ; les actions rares (supprimer) sont dans le menu de la carte.
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
  const [deleteTarget, setDeleteTarget] = useState<RoleDetailDTO | null>(null);

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
      // affichés tels quels — jamais re-devinés côté client. La modale se
      // referme dans tous les cas : le message (succès ou erreur) reste porté
      // par la notification de la page, jamais caché derrière la modale.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingDeleteId(null);
      setDeleteTarget(null);
    }
  }

  // Rôles système d'abord (ce sont les socles), puis les personnalisés par ordre alphabétique.
  const sorted = useMemo(
    () => [...roles].sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, "fr")),
    [roles],
  );
  const custom = roles.filter((r) => !r.isSystem).length;

  return (
    <div className="space-y-6 p-6">
      <AdminHeader
        parent="Administration"
        title="Rôles & permissions"
        description="Un rôle regroupe des permissions. Partez des trois rôles fournis ou créez les vôtres, permission par permission."
        action={
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus size={16} aria-hidden />
            Nouveau rôle
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<Shield size={20} />} label="Rôles" value={isLoading ? "–" : roles.length} />
        <StatTile icon={<Pencil size={20} />} label="Rôles personnalisés" value={isLoading ? "–" : custom} />
        <StatTile icon={<KeyRound size={20} />} label="Permissions disponibles" value={isLoading ? "–" : catalog.length} />
      </div>

      {isLoading ? (
        <div role="status" aria-label="Chargement…" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
              <div className="flex gap-3">
                <div className="h-11 w-11 animate-pulse rounded-lg bg-surface-subtle" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-1/2 animate-pulse rounded-sm bg-surface-subtle" />
                  <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-subtle" />
                </div>
              </div>
              <div className="h-10 animate-pulse rounded-sm bg-surface-subtle" />
              <div className="h-16 animate-pulse rounded-sm bg-surface-subtle" />
            </div>
          ))}
          <span className="sr-only">Chargement…</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          <EmptyState title="Aucun rôle." description="Créez un rôle pour attribuer des permissions à vos utilisateurs." />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((role, i) => (
            <li key={role.id}>
              <RoleCard
                role={role}
                index={i}
                catalogSize={catalog.length}
                isDeleting={pendingDeleteId === role.id}
                onEdit={() => setModal({ mode: "edit", role })}
                onDelete={() => setDeleteTarget(role)}
              />
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <RoleFormModal
          role={modal.mode === "edit" ? modal.role : undefined}
          permissionsCatalog={catalog}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Supprimer ce rôle"
          message={`Supprimer le rôle « ${deleteTarget.name} » ? Cette action est irréversible.`}
          confirmLabel="Supprimer"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          isConfirming={pendingDeleteId === deleteTarget.id}
        />
      ) : null}

      <AdminFeedback notice={notice} error={error} onDismissNotice={() => setNotice(null)} onDismissError={() => setError(null)} />
    </div>
  );
}
