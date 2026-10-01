"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
  /** §6.25 lot 0 — enregistrement en cours : ×, Échap et clic sur le fond sont
   * neutralisés, comme le bouton "Annuler" déjà désactivé par chaque formulaire. */
  closeDisabled?: boolean;
}

/**
 * §6.25 lot 0 — pile des modales ouvertes, dans l'ordre de montage. Chaque Modal
 * écoute Échap sur `window` ; sans cette pile, Échap sur une confirmation empilée
 * (ex. "Supprimer cet événement" au-dessus d'EventPanel) fermait les deux à la fois.
 * Seule la dernière montée (la plus haute visuellement) réagit.
 */
const openModals: object[] = [];

export function Modal({ title, onClose, children, widthClassName = "max-w-md", closeDisabled = false }: ModalProps) {
  const [token] = useState(() => ({}));

  useEffect(() => {
    openModals.push(token);
    return () => {
      openModals.splice(openModals.indexOf(token), 1);
    };
  }, [token]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || openModals[openModals.length - 1] !== token) return;
      if (!closeDisabled) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, closeDisabled, token]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={closeDisabled ? undefined : onClose}
    >
      <div
        className={`w-full ${widthClassName} rounded-lg border border-border bg-surface shadow-raised`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
