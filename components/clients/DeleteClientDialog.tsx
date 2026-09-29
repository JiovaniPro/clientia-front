"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { deleteClient } from "@/lib/api/clients";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

interface DeleteClientDialogProps {
  clientId: string;
  onDeleted: () => void;
  onClose: () => void;
}

/**
 * Partagé par /clients (liste) et la fiche dossier. Un 409 (CLIENT_HAS_EMAIL_HISTORY) est
 * DÉFINITIF : un dossier avec historique d'e-mails ne pourra jamais être supprimé. On ne
 * laisse donc pas le bouton de confirmation actif (il suggérerait de réessayer) : le
 * message backend est affiché tel quel dans une fenêtre d'information, avec "Fermer"
 * seulement. Autres échecs : message générique, la confirmation reste possible.
 */
export function DeleteClientDialog({ clientId, onDeleted, onClose }: DeleteClientDialogProps) {
  const { authedFetch } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setIsDeleting(true);
    setError(null);
    try {
      await authedFetch((token) => deleteClient(clientId, token));
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBlockedMessage(err.message);
      else setError("Impossible de supprimer ce dossier.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (blockedMessage) {
    return (
      <Modal title="Suppression impossible" onClose={onClose} widthClassName="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-ink">{blockedMessage}</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose} autoFocus>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <ConfirmModal
      title="Supprimer ce dossier"
      message={
        <div className="space-y-2">
          <p>Supprimer ce dossier client ? Cette action est irréversible.</p>
          {error ? <p className="text-status-danger">{error}</p> : null}
        </div>
      }
      confirmLabel="Supprimer"
      onConfirm={handleConfirm}
      onClose={onClose}
      isConfirming={isDeleting}
    />
  );
}
