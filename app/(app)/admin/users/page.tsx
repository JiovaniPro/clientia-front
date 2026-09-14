"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserFormModal } from "@/components/admin/UserFormModal";
import type { RoleListItemDTO } from "@/lib/api/roles";
import { listRoles } from "@/lib/api/roles";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers, resetPassword, setUserStatus } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

function personLabel(u: UserListItemDTO) {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

/**
 * Sous-lot Utilisateurs — CRUD complet (§2.2) : création/édition sans jamais taper
 * de mot de passe (lien envoyé par e-mail), activer/désactiver (jamais de
 * suppression physique — deux garde-fous vérifiés côté backend, affichés ici tels
 * que le serveur les formule, pas re-devinés côté client).
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
    } catch (err) {
      // Les deux garde-fous (auto-désactivation, dernier compte gestionnaire) sont
      // vérifiés côté backend — le message est affiché tel quel, jamais re-deviné ici.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingActionId(null);
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

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucun utilisateur.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Rôle</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isPending = pendingActionId === u.id;
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                    <td className="px-4 py-2.5 text-ink">
                      {personLabel(u)}
                      {isSelf ? <span className="ml-1.5 text-xs text-ink-faint">(vous)</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.role.name}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={u.isActive ? "Actif" : "Inactif"}
                        color={u.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
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
                          onClick={() => handleToggleStatus(u)}
                          disabled={isPending || (isSelf && u.isActive)}
                          title={isSelf && u.isActive ? "Vous ne pouvez pas désactiver votre propre compte" : undefined}
                        >
                          {u.isActive ? "Désactiver" : "Activer"}
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
        <UserFormModal
          user={modal.mode === "edit" ? modal.user : undefined}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
