"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReminderFormModal } from "@/components/reminders/ReminderFormModal";
import type { ReminderDTO, ReminderStatus } from "@/lib/api/reminders";
import { deleteReminder, listReminders } from "@/lib/api/reminders";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * §5.9 (personnel) + §5.19 (supervision). `reminders.viewAll` ajoute la vue
 * "toute l'organisation" — mais exclut STRUCTURELLEMENT les rappels personnels
 * (`callId: null`) d'un autre utilisateur, côté backend (voir
 * modules/reminders/service.ts) : ce n'est pas un filtre optionnel qu'on pourrait
 * contourner depuis l'écran. `PATCH /reminders/:id` reste gaté en tout-ou-rien sur
 * `reminders.update` côté backend (pas de split par champ) — mais côté écran, les
 * actions Modifier/Supprimer ne s'affichent QUE sur ses propres rappels : avec
 * `reminders.viewAll`, un admin voit les rappels liés des autres en lecture seule,
 * jamais un bouton qui échouerait en 404 (superviser n'est pas éditer, décision du
 * sous-lot 3, pas juste un oubli).
 */
const STATUS_LABELS: Record<ReminderStatus, string> = { PENDING: "À faire", DONE: "Fait", CANCELED: "Annulé" };
const STATUS_COLORS: Record<ReminderStatus, string> = {
  PENDING: "var(--color-status-warning)",
  DONE: "var(--color-forest-600)",
  CANCELED: "var(--color-ink-faint)",
};

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined, fallback: string) {
  if (!p) return fallback;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || fallback;
}

function formatDueAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function RemindersPage() {
  const { user: currentUser, authedFetch, hasPermission } = useAuth();
  const canUpdate = hasPermission("reminders.update");
  const canDelete = hasPermission("reminders.delete");
  const canCreate = hasPermission("reminders.create");
  const canViewAll = hasPermission("reminders.viewAll");

  const [reminders, setReminders] = useState<ReminderDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | "">("");
  const [agentId, setAgentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | ReminderDTO | null>(null);

  const fetchReminders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await authedFetch((token) =>
        listReminders(
          {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(agentId ? { userId: agentId } : {}),
          },
          token,
        ),
      );
      setReminders(items);
    } catch {
      setError("Impossible de charger les rappels.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, statusFilter, agentId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    if (!canViewAll) return;
    authedFetch((token) => listUsers({}, token))
      .then(setAgents)
      .catch(() => {});
  }, [canViewAll, authedFetch]);

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
          <h1 className="font-display text-2xl font-bold text-ink">{canViewAll ? "Rappels" : "Mes rappels"}</h1>
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
        {canViewAll ? (
          <Select label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-48">
            <option value="">Tous</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {personLabel(a, a.email)}
                {!a.isActive ? " (inactif)" : ""}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {canViewAll ? (
        <p className="text-xs text-ink-muted">
          Les pense-bêtes personnels des autres utilisateurs (sans appel ou dossier rattaché) ne sont jamais visibles
          ici — seuls les vôtres et les rappels liés à un appel/dossier apparaissent.
        </p>
      ) : null}

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
                {canViewAll ? <th className="px-4 py-2.5 font-medium">Agent</th> : null}
                <th className="px-4 py-2.5 font-medium">Échéance</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {reminders.map((reminder) => {
                const isOwn = reminder.userId === currentUser?.id;
                return (
                  <tr key={reminder.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                    <td className="px-4 py-2.5 text-ink">
                      <p className="font-medium">{reminder.title}</p>
                      {reminder.description ? <p className="text-xs text-ink-muted">{reminder.description}</p> : null}
                    </td>
                    {canViewAll ? (
                      <td className="px-4 py-2.5 text-ink-muted">{personLabel(reminder.user, "—")}</td>
                    ) : null}
                    <td className="px-4 py-2.5 font-mono text-ink-muted">{formatDueAt(reminder.dueAt)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={STATUS_LABELS[reminder.status]} color={STATUS_COLORS[reminder.status]} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate && isOwn ? (
                          <Button size="sm" variant="secondary" onClick={() => setModal(reminder)}>
                            Modifier
                          </Button>
                        ) : null}
                        {canDelete && isOwn ? (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(reminder)}>
                            Supprimer
                          </Button>
                        ) : null}
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
