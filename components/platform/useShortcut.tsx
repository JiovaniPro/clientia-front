"use client";

import { useEffect, useRef } from "react";

/** Vrai quand l'utilisateur tape dans un champ, ou qu'une fenêtre modale est ouverte : un raccourci ne doit pas réagir. */
function isTypingOrModal(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (el?.closest("input, textarea, select, [contenteditable='true']")) return true;
  return Boolean(document.querySelector("[role='dialog'][aria-modal='true']"));
}

/**
 * Raccourci clavier d'une touche (« n », « / »), sans modificateur, ignoré pendant la saisie et quand une
 * modale est ouverte. Le gestionnaire le plus récent est toujours utilisé (pas besoin de le mémoïser).
 */
export function useShortcut(key: string, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (isTypingOrModal(event.target)) return;
      event.preventDefault();
      handlerRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);
}

/** Petite touche affichée à côté d'une action (masquée aux lecteurs d'écran : c'est un rappel visuel). */
export function Kbd({ children, className = "" }: { children: string; className?: string }) {
  return (
    <kbd
      aria-hidden
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-current/25 px-1 font-mono text-[11px] leading-none opacity-80 ${className}`}
    >
      {children}
    </kbd>
  );
}
