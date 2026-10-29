"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { UserFormModal } from "@/components/admin/UserFormModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { RoleListItemDTO } from "@/lib/api/roles";
import { listRoles } from "@/lib/api/roles";
import { Select } from "@/components/ui/Select";
import type { DeletedUserDTO, UserListItemDTO } from "@/lib/api/users";
import { deleteUser, listDeletedUsers, listUsers, purgeUser, resetPassword, setUserStatus } from "@/lib/api/users";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

function personLabel(u: { firstName: string | null; lastName: string | null; email: string }) {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

/**
 * Sous-lot Utilisateurs — CRUD complet (§2.2) : création/édition sans jamais taper
 * de mot de passe (lien envoyé par e-mail), activer/désactiver (deux garde-fous
 * vérifiés côté backend, affichés ici tels que le serveur les formule, pas
 * re-devinés côté client), puis supprimer un compte déjà désactivé (suppression
 * douce côté backend — l'historique garde ses liens).
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
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserDTO[]>([]);
  const [purgeTarget, setPurgeTarget] = useState<DeletedUserDTO | null>(null);
  const [transferToUserId, setTransferToUserId] = useState("");

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

  const fetchDeletedUsers = useCallback(async () => {
    try {
      setDeletedUsers(await authedFetch((token) => listDeletedUsers(token)));
    } catch {
      setError("Impossible de charger les utilisateurs supprimés.");
    }
  }, [authedFetch]);

  useEffect(() => {
    if (tab === "deleted") fetchDeletedUsers();
  }, [tab, fetchDeletedUsers]);

  useEffect(() => {
    fetchUsers();
    authedFetch((token) => listRoles(token))
      .then(setRoles)
      .catch(() => setError("Impossible de charger les rôles."));
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
      setDeletedUsers((prev) => prev.filter((u) => u.id !== target.id));
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

  const columns: AdminTableColumn<UserListItemDTO>[] = [
    {
      header: "Nom",
      className: "text-ink",
      cell: (u) => (
        <>
          {personLabel(u)}
          {u.id === currentUser?.id ? <span className="ml-1.5 text-xs text-ink-faint">(vous)</span> : null}
        </>
      ),
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
    {
      header: "",
      className: "text-right",
      cell: (u) => {
        const isSelf = u.id === currentUser?.id;
        const isPending = pendingActionId === u.id;
        return (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="text-xs font-medium text-forest-600 hover:underline"
              onClick={() => setModal({ mode: "edit", user: u })}
            >
              Modifier
            </button>
            <button
              type="button"
              className="text-xs font-medium text-forest-600 hover:underline disabled:opacity-50"
              onClick={() => handleResetPassword(u)}
              disabled={isPending}
            >
              Réinitialiser le mot de passe
            </button>
            <button
              type="button"
              className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
              onClick={() => handleToggleStatusClick(u)}
              disabled={isPending || (isSelf && u.isActive)}
              title={isSelf && u.isActive ? "Vous ne pouvez pas désactiver votre propre compte" : undefined}
            >
              {u.isActive ? "Désactiver" : "Activer"}
            </button>
            {u.isActive ? null : (
              <button
                type="button"
                className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
                onClick={() => setDeleteTarget(u)}
                disabled={isPending}
              >
                Supprimer
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const deletedColumns: AdminTableColumn<DeletedUserDTO>[] = [
    { header: "Nom", className: "text-ink", cell: (u) => personLabel(u) },
    { header: "E-mail", className: "text-ink-muted", cell: (u) => u.email },
    { header: "Rôle", className: "text-ink-muted", cell: (u) => u.role.name },
    {
      header: "Supprimé le",
      className: "text-ink-muted",
      cell: (u) => new Date(u.deletedAt).toLocaleDateString("fr-FR"),
    },
    {
      header: "",
      className: "text-right",
      cell: (u) => (
        <button
          type="button"
          className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
          onClick={() => {
            setTransferToUserId(currentUser?.id ?? "");
            setPurgeTarget(u);
          }}
          disabled={pendingActionId === u.id}
        >
          Supprimer définitivement
        </button>
      ),
    },
  ];

  const activeHeirs = users.filter((u) => u.isActive);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
          <h1 className="font-display text-2xl font-bold text-ink">Utilisateurs</h1>
        </div>
        <Button onClick={() => setModal({ mode: "create" })}>Nouvel utilisateur</Button>
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

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["active", "Utilisateurs"],
            ["deleted", "Supprimés"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
              tab === key ? "border-forest-600 text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        <AdminTable columns={columns} rows={users} rowKey={(u) => u.id} isLoading={isLoading} emptyMessage="Aucun utilisateur." />
      ) : (
        <AdminTable
          columns={deletedColumns}
          rows={deletedUsers}
          rowKey={(u) => u.id}
          isLoading={false}
          emptyMessage="Aucun utilisateur supprimé."
        />
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
    </div>
  );
}
