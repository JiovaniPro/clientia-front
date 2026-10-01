"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface DeleteOrganizationModalProps {
  organizationName: string;
  userCount: number;
  onConfirm: (confirmName: string) => void;
  onClose: () => void;
  isConfirming?: boolean;
  error?: string | null;
}

/**
 * Suppression (douce) d'une organisation déjà suspendue : le bouton n'est actif que si le
 * nom saisi est EXACTEMENT celui de l'organisation (casse et espaces compris) — revérifié
 * côté serveur. "Annuler" reste le bouton dominant, comme dans ConfirmModal.
 */
export function DeleteOrganizationModal({
  organizationName,
  userCount,
  onConfirm,
  onClose,
  isConfirming = false,
  error,
}: DeleteOrganizationModalProps) {
  const [typed, setTyped] = useState("");
  const matches = typed === organizationName;

  return (
    <Modal title="Supprimer cette organisation" onClose={onClose} widthClassName="max-w-md" closeDisabled={isConfirming}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) onConfirm(typed);
        }}
      >
        <div className="space-y-2 text-sm text-ink">
          <p>
            « <strong>{organizationName}</strong> » disparaîtra de la console et{" "}
            {userCount > 1
              ? `ses ${userCount} utilisateurs ne pourront plus jamais se connecter`
              : userCount === 1
                ? "son utilisateur ne pourra plus jamais se connecter"
                : "plus personne ne pourra s'y connecter"}
            . Elle ne pourra plus être réactivée.
          </p>
          <p className="text-ink-muted">
            Les données sont conservées et restent consultables dans « Organisations supprimées ».
          </p>
        </div>
        <Input
          label={`Tapez « ${organizationName} » pour confirmer`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={isConfirming}
        />
        {error ? <p className="text-sm text-status-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isConfirming} autoFocus>
            Annuler
          </Button>
          <Button type="submit" variant="danger" disabled={!matches || isConfirming}>
            {isConfirming ? "En cours…" : "Supprimer définitivement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
