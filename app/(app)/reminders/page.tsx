"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import type { ReminderDTO, ReminderStatus } from "@/lib/api/reminders";
import { deleteReminder, listReminders } from "@/lib/api/reminders";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * §5.9 — Rappels personnels. Toujours scopés au créateur côté backend (voir
 * modules/reminders/service.ts) : "tous mes rappels", jamais une vue d'équipe.
 * `PATCH /reminders/:id` est gaté en tout-ou-rien sur `reminders.update` (pas de
 * split par champ comme `clients.editFinalStatus`) — un utilisateur qui n'a que
 * `reminders.create` (ex. Agent RDV, voir lib/defaultRoles.ts) peut donc créer un
 * rappel mais jamais le marquer fait ni le modifier ensuite. Gap métier réel, pas
 * un bug d'affichage : signalé, pas contourné — la liste reste en lecture seule
 * pour ce profil plutôt que d'afficher des actions qui échoueraient en 403.
 */
const STATUS_LABELS: Record<ReminderStatus, string> = { PENDING: "À faire", DONE: "Fait", CANCELED: "Annulé" };
const STATUS_COLORS: Record<ReminderStatus, string> = {
  PENDING: "var(--color-status-warning)",
  DONE: "var(--color-forest-600)",
  CANCELED: "var(--color-ink-faint)",
};

function formatDueAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function RemindersPage() {
  const { authedFetch, hasPermission } = useAuth();
  const canUpdate = hasPermission("reminders.update");
  const canDelete = hasPermission("reminders.delete");
  const canCreate = hasPermission("reminders.create");

  const [reminders, setReminders] = useState<ReminderDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | ReminderDTO | null>(null);

  const fetchReminders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await authedFetch((token) =>
        listReminders(statusFilter ? { status: statusFilter } : {}, token),
      );
      setReminders(items);
    } catch {
      setError("Impossible de charger les rappels.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, statusFilter]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  async function handleDelete(reminder: ReminderDTO) {
    try {
      await authedFetch((token) => deleteReminder(reminder.id, token));
      fetchReminders();
    } catch {
      setError("Impossible de supprimer ce rappel.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.9</p>
          <h1 className="font-display text-2xl font-bold text-ink">Mes rappels</h1>
        </div>
        {canCreate ? (
          <Button onClick={() => setModal("create")}>
            <Plus size={16} /> Nouveau rappel
          </Button>
        ) : null}
      </header>

      <div className="flex items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <Select
          label="Statut"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReminderStatus | "")}
          className="w-48"
        >
          <option value="">Tous</option>
          {(Object.keys(STATUS_LABELS) as ReminderStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : reminders.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucun rappel ne correspond à ces filtres.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Titre</th>
                <th className="px-4 py-2.5 font-medium">Échéance</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder) => (
                <tr key={reminder.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                  <td className="px-4 py-2.5 text-ink">
                    <p className="font-medium">{reminder.title}</p>
                    {reminder.description ? <p className="text-xs text-ink-muted">{reminder.description}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{formatDueAt(reminder.dueAt)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={STATUS_LABELS[reminder.status]} color={STATUS_COLORS[reminder.status]} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => setModal(reminder)}>
                          Modifier
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(reminder)}>
                          Supprimer
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal ? (
        <ReminderFormModal
          reminder={modal === "create" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchReminders();
          }}
        />
      ) : null}
    </div>
  );
}
