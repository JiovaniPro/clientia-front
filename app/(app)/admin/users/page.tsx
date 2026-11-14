"use client";

import { KeyRound, Pencil, Plus, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserFormModal } from "@/components/admin/UserFormModal";
import { AdminFeedback } from "@/components/admin/kit/Feedback";
import { RowMenu } from "@/components/admin/kit/RowMenu";
import { Switch } from "@/components/admin/kit/Switch";
import { AdminHeader, FilterChip, RowsSkeleton, SearchField, Segmented, StatTile } from "@/components/admin/kit/Controls";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/ListStates";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api/client";
import type { RoleListItemDTO } from "@/lib/api/roles";
import { listRoles } from "@/lib/api/roles";
import type { DeletedUserDTO, UserListItemDTO } from "@/lib/api/users";
import { deleteUser, listDeletedUsers, listUsers, purgeUser, resetPassword, setUserStatus } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

function personLabel(u: { firstName: string | null; lastName: string | null; email: string }) {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type StatusFilter = "all" | "active" | "inactive";

/**
 * Sous-lot Utilisateurs — CRUD complet (§2.2) : création/édition sans jamais taper
 * de mot de passe (lien envoyé par e-mail), activer/désactiver (deux garde-fous
 * vérifiés côté backend, affichés ici tels que le serveur les formule, pas
 * re-devinés côté client), puis supprimer un compte déjà désactivé (suppression
 * douce côté backend — l'historique garde ses liens).
 *
 * Présentation : chiffres en tête, recherche et filtres (rôle, statut) en direct, une ligne par personne avec un
 * interrupteur d'accès, la modification à portée de clic et le reste dans un menu d'actions.
 */
export default function AdminUsersPage() {
  const { authedFetch, user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserListItemDTO[]>([]);
  const [roles, setRoles] = useState<RoleListItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; user: UserListItemDTO } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserListItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItemDTO | null>(null);

  const [tab, setTab] = useState<"active" | "deleted">("active");
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserDTO[] | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeletedUserDTO | null>(null);
  const [transferToUserId, setTransferToUserId] = useState("");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await authedFetch((token) => listUsers({}, token)));
    } catch {
      setError("Impossible de charger les utilisateurs.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchUsers();
    authedFetch((token) => listRoles(token))
      .then(setRoles)
      .catch(() => setError("Impossible de charger les rôles."));
    authedFetch((token) => listDeletedUsers(token))
      .then(setDeletedUsers)
      .catch(() => setDeletedUsers([]));
  }, [fetchUsers, authedFetch]);

  function handleSaved(saved: UserListItemDTO, isNewAccount: boolean) {
    setModal(null);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === saved.id);
      return exists ? prev.map((u) => (u.id === saved.id ? saved : u)) : [...prev, saved];
    });
    setNotice(
      isNewAccount
        ? `Compte créé — un e-mail a été envoyé à ${saved.email} pour définir le mot de passe.`
        : "Utilisateur mis à jour.",
    );
  }

  async function handleToggleStatus(target: UserListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingActionId(target.id);
    try {
      const updated = await authedFetch((token) => setUserStatus(target.id, !target.isActive, token));
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNotice(updated.isActive ? `${personLabel(updated)} réactivé.` : `${personLabel(updated)} désactivé.`);
    } catch (err) {
      // Les deux garde-fous (auto-désactivation, dernier compte gestionnaire) sont
      // vérifiés côté backend — le message est affiché tel quel, jamais re-deviné ici.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingActionId(null);
      setDeactivateTarget(null);
    }
  }

  /** Seule la désactivation passe par une confirmation — réactiver n'a rien de sensible (§6.20). */
  function handleToggleStatusClick(target: UserListItemDTO) {
    if (target.isActive) {
      setDeactivateTarget(target);
    } else {
      handleToggleStatus(target);
    }
  }

  async function handleDelete(target: UserListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingActionId(target.id);
    try {
      await authedFetch((token) => deleteUser(target.id, token));
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setNotice(`${personLabel(target)} supprimé.`);
      authedFetch((token) => listDeletedUsers(token))
        .then(setDeletedUsers)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingActionId(null);
      setDeleteTarget(null);
    }
  }

  async function handlePurge(target: DeletedUserDTO) {
    setError(null);
    setNotice(null);
    setPendingActionId(target.id);
    try {
      await authedFetch((token) => purgeUser(target.id, transferToUserId, token));
      setDeletedUsers((prev) => (prev ?? []).filter((u) => u.id !== target.id));
      const heir = users.find((u) => u.id === transferToUserId);
      setNotice(`${personLabel(target)} supprimé définitivement — son historique a été transféré à ${heir ? personLabel(heir) : "l'utilisateur choisi"}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingActionId(null);
      setPurgeTarget(null);
    }
  }

  async function handleResetPassword(target: UserListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingActionId(target.id);
    try {
      await authedFetch((token) => resetPassword(target.id, token));
      setNotice(`Lien de réinitialisation envoyé à ${target.email}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingActionId(null);
    }
  }

  const roleColor = useMemo(() => new Map(roles.map((r) => [r.id, r.color])), [roles]);
  const activeCount = users.filter((u) => u.isActive).length;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = users.filter(
    (u) =>
      (statusFilter === "all" || (statusFilter === "active") === u.isActive) &&
      (!roleFilter || u.role.id === roleFilter) &&
      (!normalizedQuery || `${personLabel(u)} ${u.email} ${u.role.name}`.toLowerCase().includes(normalizedQuery)),
  );
  const hasFilters = Boolean(normalizedQuery || roleFilter || statusFilter !== "all");
  const activeHeirs = users.filter((u) => u.isActive);

  function resetFilters() {
    setQuery("");
    setRoleFilter("");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-6 p-6">
      <AdminHeader
        parent="Administration"
        title="Utilisateurs"
        description="Qui a accès à votre espace, avec quel rôle. Les accès se coupent d'un clic, sans rien supprimer."
        action={
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus size={16} aria-hidden />
            Nouvel utilisateur
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<Users size={20} />} label="Utilisateurs" value={isLoading ? "–" : users.length} />
        <StatTile icon={<UserCheck size={20} />} label="Comptes actifs" value={isLoading ? "–" : activeCount} />
        <StatTile icon={<UserX size={20} />} label="Comptes inactifs" value={isLoading ? "–" : users.length - activeCount} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Comptes"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Utilisateurs", count: users.length },
            { value: "deleted", label: "Supprimés", ...(deletedUsers ? { count: deletedUsers.length } : {}) },
          ]}
        />
      </div>

      {tab === "active" ? (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <SearchField value={query} onChange={setQuery} label="Rechercher un utilisateur" placeholder="Nom, e-mail, rôle…" />
              <Segmented
                label="Statut du compte"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "Tous" },
                  { value: "active", label: "Actifs" },
                  { value: "inactive", label: "Inactifs" },
                ]}
              />
              {hasFilters ? (
                <button type="button" onClick={resetFilters} className="text-sm font-medium text-forest-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
                  Réinitialiser
                </button>
              ) : null}
            </div>
            {roles.length > 0 ? (
              <div role="group" aria-label="Rôle" className="flex flex-wrap gap-2">
                <FilterChip label="Tous les rôles" count={users.length} active={roleFilter === ""} onClick={() => setRoleFilter("")} />
                {roles.map((r) => (
                  <FilterChip
                    key={r.id}
                    label={r.name}
                    color={r.color}
                    count={users.filter((u) => u.role.id === r.id).length}
                    active={roleFilter === r.id}
                    onClick={() => setRoleFilter(roleFilter === r.id ? "" : r.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-flat">
            {isLoading ? (
              <RowsSkeleton />
            ) : visibleUsers.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  title="Aucun utilisateur ne correspond."
                  description="Essayez un autre nom ou retirez les filtres."
                  action={
                    <Button size="sm" variant="secondary" onClick={resetFilters}>
                      Réinitialiser les filtres
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="Aucun utilisateur pour l'instant."
                  description="Invitez votre première personne : elle recevra un e-mail pour choisir son mot de passe."
                  action={
                    <Button size="sm" onClick={() => setModal({ mode: "create" })}>
                      Nouvel utilisateur
                    </Button>
                  }
                />
              )
            ) : (
              <ul className="divide-y divide-border">
                {visibleUsers.map((u, i) => {
                  const isSelf = u.id === currentUser?.id;
                  const isPending = pendingActionId === u.id;
                  return (
                    <li
                      key={u.id}
                      className="app-rise group flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-surface-subtle/60"
                      style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                    >
                      <ClientAvatar id={u.id} firstName={u.firstName} lastName={u.lastName} className={cn("h-10 w-10", !u.isActive && "opacity-50 grayscale")} />
                      <div className="min-w-0 flex-1 basis-56">
                        <p className={cn("flex items-center gap-2 truncate text-sm font-semibold", u.isActive ? "text-ink" : "text-ink-muted")}>
                          <span className="truncate">{personLabel(u)}</span>
                          {isSelf ? <span className="shrink-0 rounded-sm bg-forest-50 px-1.5 py-0.5 text-[11px] font-medium text-forest-600">Vous</span> : null}
                        </p>
                        <p className="truncate text-xs text-ink-muted">{u.email}</p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-ink">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: roleColor.get(u.role.id) ?? "var(--color-ink-faint)" }} />
                        {u.role.name}
                      </span>
                      <span className="hidden w-40 whitespace-nowrap text-xs text-ink-muted xl:block">Depuis le {formatDate(u.createdAt)}</span>
                      <div className="flex w-24 items-center gap-2">
                        <Switch
                          checked={u.isActive}
                          onChange={() => handleToggleStatusClick(u)}
                          label={`Compte de ${personLabel(u)}`}
                          disabled={isPending || (isSelf && u.isActive)}
                          title={isSelf && u.isActive ? "Vous ne pouvez pas désactiver votre propre compte" : u.isActive ? "Désactiver le compte" : "Réactiver le compte"}
                        />
                        <span className={cn("text-xs font-medium", u.isActive ? "text-forest-600" : "text-ink-muted")}>{u.isActive ? "Actif" : "Inactif"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: "edit", user: u })}
                          aria-label={`Modifier ${personLabel(u)}`}
                          title="Modifier"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-forest-600 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <RowMenu
                          label={`Plus d'actions pour ${personLabel(u)}`}
                          items={[
                            { label: "Réinitialiser le mot de passe", icon: KeyRound, onSelect: () => handleResetPassword(u), disabled: isPending },
                            {
                              label: "Supprimer le compte",
                              icon: Trash2,
                              danger: true,
                              onSelect: () => setDeleteTarget(u),
                              disabled: isPending || u.isActive,
                              hint: u.isActive ? "Désactivez d'abord le compte pour pouvoir le supprimer" : undefined,
                            },
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {!isLoading && visibleUsers.length > 0 ? (
            <p aria-live="polite" className="text-sm text-ink-muted">
              {visibleUsers.length} utilisateur{visibleUsers.length > 1 ? "s" : ""}
              {hasFilters ? ` sur ${users.length}` : ""}
            </p>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          {deletedUsers === null ? (
            <RowsSkeleton rows={3} />
          ) : deletedUsers.length === 0 ? (
            <EmptyState title="Aucun utilisateur supprimé." description="Les comptes supprimés apparaissent ici jusqu'à leur suppression définitive." />
          ) : (
            <ul className="divide-y divide-border">
              {deletedUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
                  <ClientAvatar id={u.id} firstName={u.firstName} lastName={u.lastName} className="h-10 w-10 opacity-50 grayscale" />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-semibold text-ink-muted line-through">{personLabel(u)}</p>
                    <p className="truncate text-xs text-ink-muted">{u.email}</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted">{u.role.name}</span>
                  <span className="text-xs text-ink-muted">Supprimé le {formatDate(u.deletedAt)}</span>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pendingActionId === u.id}
                    onClick={() => {
                      setTransferToUserId(currentUser?.id ?? "");
                      setPurgeTarget(u);
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                    Supprimer définitivement
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal ? (
        <UserFormModal
          user={modal.mode === "edit" ? modal.user : undefined}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deactivateTarget ? (
        <ConfirmModal
          title="Désactiver ce compte"
          message={`Désactiver le compte de ${personLabel(deactivateTarget)} ? Cette personne perdra immédiatement l'accès.`}
          confirmLabel="Désactiver"
          onConfirm={() => handleToggleStatus(deactivateTarget)}
          onClose={() => setDeactivateTarget(null)}
          isConfirming={pendingActionId === deactivateTarget.id}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Supprimer ce compte"
          message={`Supprimer définitivement le compte de ${personLabel(deleteTarget)} ? Il ne pourra plus être réactivé. Ses appels, dossiers et son historique sont conservés.`}
          confirmLabel="Supprimer"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          isConfirming={pendingActionId === deleteTarget.id}
        />
      ) : null}

      {purgeTarget ? (
        <ConfirmModal
          title="Supprimer définitivement"
          message={
            <div className="space-y-3">
              <p>
                Effacer définitivement le compte de {personLabel(purgeTarget)} ? Ses appels, dossiers, rendez-vous,
                rappels, calendriers et e-mails seront transférés à l&apos;utilisateur choisi ci-dessous. Irréversible.
              </p>
              <Select
                label="Transférer l'historique à"
                value={transferToUserId}
                onChange={(e) => setTransferToUserId(e.target.value)}
              >
                {activeHeirs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {personLabel(u)} — {u.role.name}
                  </option>
                ))}
              </Select>
            </div>
          }
          confirmLabel="Supprimer définitivement"
          onConfirm={() => handlePurge(purgeTarget)}
          onClose={() => setPurgeTarget(null)}
          isConfirming={pendingActionId === purgeTarget.id}
        />
      ) : null}

      <AdminFeedback notice={notice} error={error} onDismissNotice={() => setNotice(null)} onDismissError={() => setError(null)} />
    </div>
  );
}
