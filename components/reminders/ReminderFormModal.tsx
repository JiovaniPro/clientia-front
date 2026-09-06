"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api/client";
import type { ReminderDTO, ReminderStatus } from "@/lib/api/reminders";
import { createReminder, updateReminder } from "@/lib/api/reminders";
import { useAuth } from "@/lib/auth/AuthContext";

interface ReminderFormModalProps {
  /** Présent = édition, absent = création. Le backend gate `PATCH /reminders/:id`
   * entièrement sur `reminders.update` (pas de split par champ comme pour
   * `clients.editFinalStatus`) — donc ce composant n'est monté à l'édition que si
   * l'appelant a déjà vérifié cette permission (voir page.tsx). */
  reminder?: ReminderDTO;
  onClose: () => void;
  onSaved: () => void;
}

/** ISO <-> `datetime-local` : le champ HTML travaille en heure locale, sans fuseau ni secondes. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_OPTIONS: { value: ReminderStatus; label: string }[] = [
  { value: "PENDING", label: "À faire" },
  { value: "DONE", label: "Fait" },
  { value: "CANCELED", label: "Annulé" },
];

export function ReminderFormModal({ reminder, onClose, onSaved }: ReminderFormModalProps) {
  const { authedFetch } = useAuth();
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [description, setDescription] = useState(reminder?.description ?? "");
  const [dueAt, setDueAt] = useState(reminder ? toDatetimeLocal(reminder.dueAt) : "");
  const [status, setStatus] = useState<ReminderStatus>(reminder?.status ?? "PENDING");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !dueAt) {
      setError("Le titre et l'échéance sont obligatoires.");
      return;
    }
    setIsSubmitting(true);
    try {
      const dueAtIso = new Date(dueAt).toISOString();
      if (reminder) {
        await authedFetch((token) =>
          updateReminder(reminder.id, { title, description: description || undefined, dueAt: dueAtIso, status }, token),
        );
      } else {
        await authedFetch((token) => createReminder({ title, description: description || undefined, dueAt: dueAtIso }, token));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={reminder ? "Modifier le rappel" : "Nouveau rappel"} onClose={onClose}>
      <div className="space-y-4">
        <Input
          label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink" htmlFor="reminder-description">
            Description
          </label>
          <textarea
            id="reminder-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
              rows={3}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600 disabled:opacity-60"
          />
        </div>
        <Input
          label="Échéance"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          required
        />
        {reminder ? (
          <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value as ReminderStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
