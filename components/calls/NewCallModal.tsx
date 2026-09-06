"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { createCall } from "@/lib/api/calls";
import type { CallDTO, CallDirection, CallType } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";

interface NewCallModalProps {
  statuses: ConfigurableListItemDTO[];
  onClose: () => void;
  onCreated: (call: CallDTO) => void;
}

const CALL_TYPES: CallType[] = ["PROSPECTION", "SUPPORT", "FOLLOW_UP", "OTHER"];

/** §5.5 — saisie manuelle d'un appel (hors import). Mêmes règles conditionnelles que la qualification. */
export function NewCallModal({ statuses, onClose, onCreated }: NewCallModalProps) {
  const { authedFetch } = useAuth();
  const defaultStatus = statuses.find((s) => s.isDefault) ?? statuses[0];

  const [direction, setDirection] = useState<CallDirection>("OUTBOUND");
  const [type, setType] = useState<CallType>("PROSPECTION");
  const [statusKey, setStatusKey] = useState(defaultStatus?.key ?? "");
  const [fromNumber, setFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [notes, setNotes] = useState("");
  const [recallDate, setRecallDate] = useState("");
  const [recallTimeSlot, setRecallTimeSlot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStatus = statuses.find((s) => s.key === statusKey);
  const requiresRecallDate = Boolean(selectedStatus?.metadata?.requiresRecallDate);

  async function handleSubmit() {
    setError(null);
    if (requiresRecallDate && !recallDate) {
      setError("Ce statut exige une date de rappel.");
      return;
    }
    if (!toNumber) {
      setError("Le numéro de téléphone est requis.");
      return;
    }
    if (!fromNumber) {
      setError("Le numéro sortant est requis.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { call } = await authedFetch((token) =>
        createCall(
          {
            direction,
            type,
            statusKey,
            fromNumber,
            toNumber,
            occurredAt: new Date().toISOString(),
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            notes: notes || undefined,
            ...(recallDate ? { recallDate: new Date(recallDate).toISOString() } : {}),
            ...(recallTimeSlot ? { recallTimeSlot } : {}),
          },
          token,
        ),
      );
      onCreated(call);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Nouvel appel" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sens" value={direction} onChange={(e) => setDirection(e.target.value as CallDirection)}>
            <option value="OUTBOUND">Sortant</option>
            <option value="INBOUND">Entrant</option>
          </Select>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as CallType)}>
            {CALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Numéro sortant" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} required />
          <Input label="Téléphone appelé" value={toNumber} onChange={(e) => setToNumber(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>

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

        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
