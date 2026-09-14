"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { PermissionDTO, RoleDetailDTO } from "@/lib/api/roles";
import { createRole, updateRole } from "@/lib/api/roles";
import { useAuth } from "@/lib/auth/AuthContext";

interface RoleFormModalProps {
  /** Présent = édition, absent = création. */
  role?: RoleDetailDTO;
  permissionsCatalog: PermissionDTO[];
  onClose: () => void;
  onSaved: (role: RoleDetailDTO) => void;
}

function groupByModule(permissions: PermissionDTO[]): Map<string, PermissionDTO[]> {
  const groups = new Map<string, PermissionDTO[]>();
  for (const p of permissions) {
    const list = groups.get(p.module) ?? [];
    list.push(p);
    groups.set(p.module, list);
  }
  return groups;
}

export function RoleFormModal({ role, permissionsCatalog, onClose, onSaved }: RoleFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(role);

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color ?? "#2f6f4f");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(role?.permissions.map((p) => p.permission.key) ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groups = groupByModule(permissionsCatalog);

  function togglePermission(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(keys: string[], allSelected: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom du rôle est obligatoire.");
      return;
    }
    setIsSubmitting(true);
    try {
      const permissionKeys = Array.from(selectedKeys);
      if (isEdit && role) {
        const updated = await authedFetch((token) =>
          updateRole(role.id, { name, description: description || undefined, color, permissionKeys }, token),
        );
        onSaved(updated);
      } else {
        const created = await authedFetch((token) =>
          createRole({ name, description: description || undefined, color, permissionKeys }, token),
        );
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Modifier le rôle" : "Nouveau rôle"} onClose={onClose} widthClassName="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Couleur</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 rounded-md border border-border bg-surface"
            />
          </div>
        </div>

        {isEdit && role?.isSystem ? (
          <p className="text-xs text-ink-muted">
            Rôle système : le nom, la description et les permissions restent modifiables, mais ce rôle ne peut pas
            être supprimé.
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Permissions</p>
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border p-3">
            {Array.from(groups.entries()).map(([module, perms]) => {
              const moduleKeys = perms.map((p) => p.key);
              const allSelected = moduleKeys.every((k) => selectedKeys.has(k));
              return (
                <div key={module}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input type="checkbox" checked={allSelected} onChange={() => toggleModule(moduleKeys, allSelected)} />
                    {module}
                  </label>
                  <div className="mt-1.5 ml-5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {perms.map((p) => (
                      <label key={p.key} className="flex items-start gap-2 text-sm text-ink-muted">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedKeys.has(p.key)}
                          onChange={() => togglePermission(p.key)}
                        />
                        <span title={p.description ?? undefined}>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
