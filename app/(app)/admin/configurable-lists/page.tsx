"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Select";
import { ListItemFormModal } from "@/components/admin/ListItemFormModal";
import { ApiError } from "@/lib/api/client";
import type { BehaviorFlagDTO, ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { deleteListItem, getBehaviorFlagsCatalog, listAllConfigurableLists, updateListItem } from "@/lib/api/configurableLists";
import { listKeyLabel } from "@/lib/nav/listKeyLabels";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Écran d'administration §5.22 (sous-lots A + B + C — lecture, désactivation,
 * création, édition, suppression). "Désactiver" (isActive:false) reste la voie
 * normale pour retirer une valeur déjà utilisée des nouvelles saisies sans toucher
 * à l'historique ; "Supprimer" est une suppression physique, bloquée côté backend
 * si la valeur est encore référencée par un enregistrement existant ou si elle est
 * la valeur par défaut de sa liste (message backend affiché tel quel, jamais re-deviné ici).
 */
export default function AdminConfigurableListsPage() {
  const { authedFetch } = useAuth();

  const [grouped, setGrouped] = useState<Record<string, ConfigurableListItemDTO[]>>({});
  const [behaviorFlagsCatalog, setBehaviorFlagsCatalog] = useState<Record<string, BehaviorFlagDTO[]>>({});
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; item: ConfigurableListItemDTO } | null>(
    null,
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, flags] = await Promise.all([
        authedFetch((token) => listAllConfigurableLists(token)),
        authedFetch((token) => getBehaviorFlagsCatalog(token)),
      ]);
      setGrouped(data);
      setBehaviorFlagsCatalog(flags);
      setSelectedKey((prev) => prev || Object.keys(data)[0] || "");
    } catch {
      setError("Impossible de charger les listes configurables.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const listKeys = Object.keys(grouped).sort((a, b) => listKeyLabel(a).localeCompare(listKeyLabel(b)));
  const items = useMemo(
    () => [...(grouped[selectedKey] ?? [])].sort((a, b) => a.order - b.order),
    [grouped, selectedKey],
  );

  function upsertItem(updated: ConfigurableListItemDTO) {
    setGrouped((prev) => {
      const list = prev[updated.listKey] ?? [];
      const exists = list.some((i) => i.id === updated.id);
      return { ...prev, [updated.listKey]: exists ? list.map((i) => (i.id === updated.id ? updated : i)) : [...list, updated] };
    });
  }

  async function handleToggleActive(item: ConfigurableListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingId(item.id);
    try {
      const updated = await authedFetch((token) => updateListItem(item.id, { isActive: !item.isActive }, token));
      upsertItem(updated);
      setNotice(updated.isActive ? `« ${updated.label} » réactivé.` : `« ${updated.label} » désactivé.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  function handleSaved(saved: ConfigurableListItemDTO) {
    setModal(null);
    upsertItem(saved);
    setNotice(modal?.mode === "create" ? `« ${saved.label} » créé.` : "Valeur mise à jour.");
  }

  async function handleDelete(item: ConfigurableListItemDTO) {
    setError(null);
    setNotice(null);
    setPendingId(item.id);
    try {
      await authedFetch((token) => deleteListItem(item.id, token));
      setGrouped((prev) => ({
        ...prev,
        [item.listKey]: (prev[item.listKey] ?? []).filter((i) => i.id !== item.id),
      }));
      setNotice(`« ${item.label} » supprimé.`);
    } catch (err) {
      // Le garde-fou vient de la contrainte de clé étrangère côté base (valeur
      // encore référencée) ou du statut "par défaut" — message backend affiché tel quel.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  const columns: AdminTableColumn<ConfigurableListItemDTO>[] = [
    {
      header: "Valeur",
      className: "text-ink",
      cell: (item) => <StatusBadge label={item.label} color={item.color} />,
    },
    { header: "Clé", className: "font-mono text-xs text-ink-faint", cell: (item) => item.key },
    { header: "Ordre", className: "text-ink-muted", cell: (item) => item.order },
    { header: "Par défaut", className: "text-ink-muted", cell: (item) => (item.isDefault ? "Oui" : "—") },
    {
      header: "Statut",
      cell: (item) => (
        <StatusBadge
          label={item.isActive ? "Actif" : "Inactif"}
          color={item.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"}
        />
      ),
    },
    {
      header: "",
      className: "text-right",
      cell: (item) => (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-xs font-medium text-forest-600 hover:underline"
            onClick={() => setModal({ mode: "edit", item })}
          >
            Modifier
          </button>
          <button
            type="button"
            className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
            onClick={() => handleToggleActive(item)}
            disabled={pendingId === item.id}
          >
            {item.isActive ? "Désactiver" : "Réactiver"}
          </button>
          <button
            type="button"
            className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
            onClick={() => handleDelete(item)}
            disabled={pendingId === item.id || item.isDefault}
            title={item.isDefault ? "La valeur par défaut d'une liste ne peut pas être supprimée" : undefined}
          >
            Supprimer
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
          <h1 className="font-display text-2xl font-bold text-ink">Listes configurables</h1>
        </div>
        <Button onClick={() => setModal({ mode: "create" })} disabled={!selectedKey}>
          Nouvelle valeur
        </Button>
      </header>

      <p className="text-sm text-ink-muted">
        Désactiver une valeur la retire des listes déroulantes pour les nouvelles saisies, mais ne supprime rien —
        l&apos;historique des enregistrements existants reste intact.
      </p>

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

      {listKeys.length > 0 ? (
        <Select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="max-w-xs">
          {listKeys.map((key) => (
            <option key={key} value={key}>
              {listKeyLabel(key)}
            </option>
          ))}
        </Select>
      ) : null}

      <AdminTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="Aucune valeur dans cette liste."
      />

      {modal && selectedKey ? (
        <ListItemFormModal
          listKey={selectedKey}
          item={modal.mode === "edit" ? modal.item : undefined}
          behaviorFlags={behaviorFlagsCatalog[selectedKey] ?? []}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
