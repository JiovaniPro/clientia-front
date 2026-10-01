"use client";

import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * Sérialisation stable des valeurs d'un formulaire : un `Set` devient un tableau
 * trié (l'ordre d'insertion ne compte pas — cocher A puis B = cocher B puis A).
 */
export function serializeFormValues(values: unknown): string {
  return JSON.stringify(values, (_key, value: unknown) =>
    value instanceof Set ? Array.from(value).map(String).sort() : value,
  );
}

/**
 * §6.25 — avertir avant de perdre une saisie non enregistrée.
 *
 * Comparaison réelle à la référence prise au montage (pas un simple "touché") :
 * taper puis effacer un caractère ne déclenche rien. `values` = uniquement les
 * champs saisis par l'utilisateur, jamais les états d'UI (erreur, chargement).
 *
 * - `requestClose` remplace `onClose` partout où la modale peut se fermer
 *   (`<Modal onClose>` couvre ×, Échap et clic sur le fond ; + bouton "Annuler").
 * - `beforeunload` n'est actif que tant que le formulaire est modifié — le message
 *   affiché est celui, générique, du navigateur (non personnalisable).
 * - `confirmElement` est à rendre à côté de la modale (pas dedans).
 * - `ready` (vrai par défaut) : pour un formulaire dont des valeurs par défaut
 *   arrivent après le montage (ex. pays par défaut chargé depuis l'API), la
 *   référence n'est prise qu'au premier rendu où `ready` est vrai — sinon ce
 *   pré-remplissage serait pris pour une saisie. Rien n'est jamais "modifié" avant.
 * - `markClean` : après un enregistrement réussi d'un formulaire qui reste affiché
 *   (formulaires inline) — la référence est reprise au rendu suivant, donc APRÈS
 *   application des valeurs rechargées dans le même lot de mises à jour.
 * - `onClose` absent (formulaires inline) : seuls `isDirty` et `beforeunload` servent.
 */
export function useUnsavedChangesGuard(values: unknown, onClose?: () => void, ready = true) {
  const current = serializeFormValues(values);
  const [initial, setInitial] = useState<string | null>(() => (ready ? current : null));
  if (ready && initial === null) setInitial(current); // état dérivé, pattern React documenté
  const isDirty = initial !== null && current !== initial;
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = ""; // requis par Chrome < 119 pour afficher la boîte de dialogue
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function requestClose() {
    if (isDirty) setIsConfirming(true);
    else onClose?.();
  }

  const confirmElement = isConfirming ? (
    <ConfirmModal
      title="Modifications non enregistrées"
      message="Les modifications apportées à ce formulaire seront perdues."
      confirmLabel="Quitter sans enregistrer"
      cancelLabel="Continuer la modification"
      variant="neutral"
      onConfirm={() => {
        setIsConfirming(false);
        onClose?.();
      }}
      onClose={() => setIsConfirming(false)}
    />
  ) : null;

  const markClean = () => setInitial(null);

  return { isDirty, requestClose, confirmElement, markClean };
}
