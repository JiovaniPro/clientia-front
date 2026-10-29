"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { importCalls } from "@/lib/api/calls";
import type { ImportCallsResponse } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { UserListItemDTO } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

interface ImportCallsModalProps {
  onClose: () => void;
  onImported: () => void;
  /** Fourni pour l'admin (calls.viewAll) : il doit choisir l'agent calliste qui reçoit les leads. */
  agents?: UserListItemDTO[];
}

const agentName = (a: UserListItemDTO) => `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || a.email;

/**
 * §6.5 — version minimale : dépôt de fichier + résultat réel (POST /calls/import,
 * qui parse et importe côté backend). Pas d'aperçu ni de mapping de colonnes
 * personnalisé ici — le backend détecte déjà les colonnes par alias (prénom/nom/
 * téléphone/email, FR/EN). À enrichir si un vrai besoin de mapping apparaît.
 */
export function ImportCallsModal({ onClose, onImported, agents }: ImportCallsModalProps) {
  const { authedFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const mustChooseAgent = agents !== undefined;
  const assignee = agents?.find((a) => a.id === assigneeId);
  const [result, setResult] = useState<ImportCallsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!file || (mustChooseAgent && !assigneeId)) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authedFetch((token) => importCalls(file, token, assigneeId || undefined));
      setResult(response);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Importer des appels" onClose={onClose} closeDisabled={isSubmitting}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Fichier .csv ou .xlsx avec colonnes prénom/nom/téléphone/email (alias FR ou EN reconnus). Chaque import crée
          une nouvelle vague.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
        />

        {mustChooseAgent && file && !result ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Attribuer les appels à</legend>
            {agents.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucun agent calliste actif dans l&apos;organisation.</p>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                      assigneeId === agent.id
                        ? "border-forest-600 bg-forest-600/5"
                        : "border-border hover:bg-surface-subtle",
                    )}
                  >
                    <input
                      type="radio"
                      name="assignee"
                      value={agent.id}
                      checked={assigneeId === agent.id}
                      onChange={() => setAssigneeId(agent.id)}
                      className="accent-forest-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{agentName(agent)}</span>
                      <span className="block truncate text-xs text-ink-muted">{agent.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}
        {result ? (
          <p className="text-sm text-status-success">
            Vague V-{result.waveNumber} créée — {result.count} appel{result.count > 1 ? "s" : ""} importé
            {result.count > 1 ? "s" : ""}
            {assignee ? ` dans la file de ${agentName(assignee)}` : ""}.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {result ? "Fermer" : "Annuler"}
          </Button>
          {result ? null : (
            <Button onClick={handleSubmit} disabled={!file || (mustChooseAgent && !assigneeId) || isSubmitting}>
              {isSubmitting ? "Import…" : "Importer"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
