"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Numéro affiché + bouton copier. Volontairement pas de lien `tel:` (retiré à la demande de l'utilisateur).
 * La copie utilise le numéro sans espaces ni ponctuation (collable tel quel dans un softphone).
 */
export function PhoneLink({ number, className }: { number: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  if (!number) return <span className={className}>—</span>;
  const dialable = number.replace(/[^\d+]/g, "");

  async function handleCopy(event: React.MouseEvent) {
    // Ne pas déclencher un éventuel clic de ligne (tableaux cliquables, lot 2).
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(dialable);
      setCopied(true);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission refusée) — le numéro reste sélectionnable.
    }
  }

  return (
    // `relative` : contient le texte sr-only (position absolute) — sans ça il se place par rapport à la page
    // et allonge le document, d'où une 2e barre de défilement sous la zone <main> qui défile déjà.
    <span className="relative inline-flex items-center gap-1">
      <span className={cn("font-mono text-forest-600", className)}>{number}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Numéro copié" : `Copier le numéro ${number}`}
        title={copied ? "Copié" : "Copier le numéro"}
        className="rounded-sm p-0.5 text-ink-faint hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
      >
        {copied ? <Check size={14} className="text-status-success" aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <span className="sr-only" role="status">
        {copied ? "Numéro copié" : ""}
      </span>
    </span>
  );
}
