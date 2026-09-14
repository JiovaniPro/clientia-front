"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api/client";
import type { RoleListItemDTO } from "@/lib/api/roles";
import type { UserListItemDTO } from "@/lib/api/users";
import { createUser, updateUser } from "@/lib/api/users";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth/AuthContext";

interface UserFormModalProps {
  /** Présent = édition, absent = création. */
  user?: UserListItemDTO;
  roles: RoleListItemDTO[];
  onClose: () => void;
  onSaved: (user: UserListItemDTO, isNewAccount: boolean) => void;
}

/**
 * Sous-lot Utilisateurs — jamais de champ mot de passe ici, création ou édition
 * (§2.2) : le mot de passe initial est aléatoire et inconnu de tous, communiqué à
 * l'utilisateur uniquement via le lien envoyé par e-mail (voir onSaved, qui
 * affiche cette information à l'admin côté page).
 */
export function UserFormModal({ user, roles, onClose, onSaved }: UserFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(user);

  const [email, setEmail] = useState(user?.email ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [roleId, setRoleId] = useState(user?.role.id ?? roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !roleId) {
      setError("L'e-mail et le rôle sont obligatoires.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && user) {
        const updated = await authedFetch((token) =>
          updateUser(user.id, { email, firstName: firstName || undefined, lastName: lastName || undefined, roleId }, token),
        );
        onSaved(updated, false);
      } else {
        const created = await authedFetch((token) =>
          createUser({ email, firstName: firstName || undefined, lastName: lastName || undefined, roleId }, token),
        );
        onSaved(created, true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Select label="Rôle" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>

        {!isEdit ? (
          <p className="text-xs text-ink-muted">
            Aucun mot de passe n'est défini ici : un e-mail est envoyé à cette adresse avec un lien pour en
            définir un (valable 24h).
          </p>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
