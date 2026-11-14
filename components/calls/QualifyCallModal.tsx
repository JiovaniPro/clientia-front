"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CreateClientDossierModal } from "@/components/calls/CreateClientDossierModal";
import { asksForRecallDate, CLIENT_DOSSIER_REQUIRED_CODE, changeCallStatus } from "@/lib/api/calls";
import type { CallDTO, ChangeCallStatusInput } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { ClientDetailDTO } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";
import { cn } from "@/lib/cn";

/**
 * Créneaux proposés en un clic. La valeur reste un texte libre (champ "Créneau" éditable) : le backend
 * en lit le premier nombre pour l'heure du rappel automatique (calls/autoReminder.ts — "9h-12h" → 9h00).
 */
const RECALL_SLOT_PRESETS = [
  { label: "Matin", value: "9h-12h" },
  { label: "Après-midi", value: "14h-17h" },
  { label: "Fin de journée", value: "17h-19h" },
];

interface QualifyCallModalProps {
  call: CallDTO;
  statuses: ConfigurableListItemDTO[];
  onClose: () => void;
  onSaved: (call: CallDTO) => void;
}

/**
 * §5.5 / §P0.2 : qualification d'un appel. Deux règles conditionnelles réelles,
 * appliquées côté backend (pas seulement en apparence côté front) :
 *  - `metadata.requiresRecallDate` → date + créneau de rappel obligatoires.
 *  - `metadata.triggersClientDossierCreation` → le backend refuse (409,
 *    details.code === CLIENT_DOSSIER_REQUIRED) tant qu'aucun dossier n'existe ;
 *    ce composant intercepte cette erreur précise, ouvre la création de dossier,
 *    puis rejoue automatiquement cette même sauvegarde de statut.
 *  - §P0.4 "suite du flux" / §P1.1 : une fois le dossier créé ET le statut
 *    effectivement enregistré, redirection vers /calendar-pro?pendingClientId=…
 *    pour planifier le RDV — voir handleDossierCreated ci-dessous. Pont
 *    volontairement porté par un simple paramètre d'URL (pas de nouvel état
 *    partagé/endpoint) : /calendar-pro relit le client via GET /clients/:id déjà
 *    existant.
 */
export function QualifyCallModal({ call, statuses, onClose, onSaved }: QualifyCallModalProps) {
  const { authedFetch } = useAuth();
  const router = useRouter();
  const [statusKey, setStatusKey] = useState(call.status.key);
  const [recallDate, setRecallDate] = useState("");
  const [recallTimeSlot, setRecallTimeSlot] = useState("");
  const initialNotes = call.notes ?? "";
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDossier, setShowCreateDossier] = useState(false);
  // §6.25 — appelé avant le rendu de remplacement ci-dessous : la bascule vers
  // CreateClientDossierModal (409 CLIENT_DOSSIER_REQUIRED) ne passe jamais par
  // requestClose, et ce composant reste monté pendant l'étape dossier — sa
  // référence et la saisie en cours sont conservées pour le retour.
  const { requestClose, confirmElement } = useUnsavedChangesGuard({ statusKey, recallDate, recallTimeSlot, notes }, onClose);

  const selectedStatus = statuses.find((s) => s.key === statusKey);
  const requiresRecallDate = asksForRecallDate(selectedStatus);

  async function submitStatusChange() {
    const input: ChangeCallStatusInput = {
      statusKey,
      ...(requiresRecallDate && recallDate ? { recallDate: new Date(recallDate).toISOString() } : {}),
      ...(requiresRecallDate && recallTimeSlot ? { recallTimeSlot } : {}),
      // Envoyées seulement si modifiées : rejouer la sauvegarde après création du dossier reste identique.
      ...(notes !== initialNotes ? { notes } : {}),
    };
    const { call: updated } = await authedFetch((token) => changeCallStatus(call.id, input, token));
    return updated;
  }

  async function handleSubmit() {
    setError(null);
    if (requiresRecallDate && !recallDate) {
      setError("Ce statut exige une date de rappel.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await submitStatusChange();
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const code = (err.details as { code?: string } | undefined)?.code;
        if (code === CLIENT_DOSSIER_REQUIRED_CODE) {
          setShowCreateDossier(true);
          setIsSubmitting(false);
          return;
        }
      }
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDossierCreated(client: ClientDetailDTO) {
    setShowCreateDossier(false);
    setIsSubmitting(true);
    setError(null);
    try {
      // Cascade : le dossier existe maintenant, on rejoue la même sauvegarde de statut.
      const updated = await submitStatusChange();
      onSaved(updated);
      // §P0.4/§P1.1 : dossier créé ET statut réellement enregistré -> direction le calendrier.
      router.push(`/calendar-pro?pendingClientId=${client.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showCreateDossier) {
    return (
      <CreateClientDossierModal call={call} onClose={() => setShowCreateDossier(false)} onCreated={handleDossierCreated} />
    );
  }

  return (
    <>
    <Modal title={`Qualifier — ${call.toNumber}`} onClose={requestClose} closeDisabled={isSubmitting}>
      <div className="space-y-4">
        <Select label="Statut" value={statusKey} onChange={(e) => setStatusKey(e.target.value)}>
          {statuses.map((status) => (
            <option key={status.id} value={status.key}>
              {status.label}
            </option>
          ))}
        </Select>

        {requiresRecallDate ? (
          <div className="space-y-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date de rappel"
                type="date"
                value={recallDate}
                onChange={(e) => setRecallDate(e.target.value)}
                required
              />
              <Input
                label="Créneau"
                placeholder="ex. 14h30 ou 15h-16h"
                value={recallTimeSlot}
                onChange={(e) => setRecallTimeSlot(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Créneaux prédéfinis">
              {RECALL_SLOT_PRESETS.map((preset) => {
                const isActive = recallTimeSlot === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setRecallTimeSlot(isActive ? "" : preset.value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                      isActive
                        ? "border-forest-600 bg-forest-50 text-forest-600"
                        : "border-border bg-surface text-ink-muted hover:text-ink",
                    )}
                  >
                    {preset.label} <span className="font-mono">{preset.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink" htmlFor="qualify-call-notes">
            Notes
          </label>
          <textarea
            id="qualify-call-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ce qui s'est dit pendant l'appel…"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600 disabled:opacity-60"
          />
        </div>

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
    {confirmElement}
    </>
  );
}
