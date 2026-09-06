"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { importCalls } from "@/lib/api/calls";
import type { ImportCallsResponse } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

interface ImportCallsModalProps {
  onClose: () => void;
  onImported: () => void;
}

/**
 * §6.5 — version minimale : dépôt de fichier + résultat réel (POST /calls/import,
 * qui parse et importe côté backend). Pas d'aperçu ni de mapping de colonnes
 * personnalisé ici — le backend détecte déjà les colonnes par alias (prénom/nom/
 * téléphone/email, FR/EN). À enrichir si un vrai besoin de mapping apparaît.
 */
export function ImportCallsModal({ onClose, onImported }: ImportCallsModalProps) {
  const { authedFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportCallsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!file) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await authedFetch((token) => importCalls(file, token));
      setResult(response);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Importer des appels" onClose={onClose}>
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

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}
        {result ? (
          <p className="text-sm text-status-success">
            Vague V-{result.waveNumber} créée — {result.count} appel{result.count > 1 ? "s" : ""} importé
            {result.count > 1 ? "s" : ""}.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {result ? "Fermer" : "Annuler"}
          </Button>
          {result ? null : (
            <Button onClick={handleSubmit} disabled={!file || isSubmitting}>
              {isSubmitting ? "Import…" : "Importer"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
