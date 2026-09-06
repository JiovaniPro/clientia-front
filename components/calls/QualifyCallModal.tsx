"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { CreateClientDossierModal } from "@/components/calls/CreateClientDossierModal";
import { CLIENT_DOSSIER_REQUIRED_CODE, changeCallStatus } from "@/lib/api/calls";
import type { CallDTO, ChangeCallStatusInput } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { ClientDetailDTO } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDossier, setShowCreateDossier] = useState(false);

  const selectedStatus = statuses.find((s) => s.key === statusKey);
  const requiresRecallDate = Boolean(selectedStatus?.metadata?.requiresRecallDate);

  async function submitStatusChange() {
    const input: ChangeCallStatusInput = {
      statusKey,
      ...(recallDate ? { recallDate: new Date(recallDate).toISOString() } : {}),
      ...(recallTimeSlot ? { recallTimeSlot } : {}),
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
    <Modal title={`Qualifier — ${call.toNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <Select label="Statut" value={statusKey} onChange={(e) => setStatusKey(e.target.value)}>
          {statuses.map((status) => (
            <option key={status.id} value={status.key}>
              {status.label}
            </option>
          ))}
        </Select>

        {requiresRecallDate ? (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
            <Input
              label="Date de rappel"
              type="date"
              value={recallDate}
              onChange={(e) => setRecallDate(e.target.value)}
              required
            />
            <Input
              label="Créneau"
              placeholder="14h-16h"
              value={recallTimeSlot}
              onChange={(e) => setRecallTimeSlot(e.target.value)}
            />
          </div>
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
