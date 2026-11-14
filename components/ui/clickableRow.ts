import type { KeyboardEvent, MouseEvent } from "react";

/** Un clic sur l'un de ces éléments (ou à l'intérieur) garde son propre effet et n'ouvre pas la ligne. */
const INTERACTIVE = "a, button, input, select, textarea, label, [role='button']";

/** Classes à ajouter sur le <tr> : curseur, survol déjà présent sur les lignes, focus clavier visible. */
export const CLICKABLE_ROW_CLASS =
  "cursor-pointer focus-visible:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest-600";

/**
 * Ligne de tableau qui ouvre un détail : clic n'importe où sauf sur un élément interactif de la ligne
 * (numéro à copier, select, case à cocher, bouton), ou Entrée quand la ligne a le focus.
 * Un bouton "Ouvrir"/"Détails" reste dans la ligne : c'est lui que les lecteurs d'écran annoncent.
 */
export function clickableRowProps(onOpen: () => void) {
  return {
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
      // Sélection de texte à la souris (copier un nom) : ce n'est pas un clic d'ouverture.
      if (window.getSelection()?.toString()) return;
      onOpen();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" || event.target !== event.currentTarget) return;
      event.preventDefault();
      onOpen();
    },
  };
}
