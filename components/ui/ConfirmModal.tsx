"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmModalProps {
  title: string;
  /** Texte simple ou JSX — pour un message contextuel précis (ex. compteur d'utilisateurs déjà chargé côté écran). */
  message: ReactNode;
  confirmLabel: string;
  /** Libellé du bouton dominant — "Annuler" par défaut. */
  cancelLabel?: string;
  /** `danger` = action destructive (bouton rouge) ; `neutral` = interruption simple (ex. déconnexion), bouton primaire habituel. */
  variant?: "danger" | "neutral";
  onConfirm: () => void;
  onClose: () => void;
  isConfirming?: boolean;
}

/**
 * §6.18-§6.27 — composant unique pour toute action destructive/sensible du
 * produit. "Annuler" reste toujours le bouton dominant visuellement (secondary,
 * premier dans l'ordre de tabulation) — exigence explicite du brief design pour
 * éviter les clics accidentels sur l'action destructive. Le message d'erreur
 * éventuel (ex. contrainte backend P2003) reste porté par l'écran appelant, pas
 * par cette modale elle-même : un composant bête, réutilisable partout.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = "Annuler",
  variant = "danger",
  onConfirm,
  onClose,
  isConfirming = false,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose} widthClassName="max-w-sm" closeDisabled={isConfirming}>
      <div className="space-y-4">
        <div className="text-sm text-ink">{message}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isConfirming} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "En cours…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
