"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Adresse de contact copiable d'un clic (bloc contact, sur fond vert profond). */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // presse-papiers indisponible : l'adresse reste lisible et sélectionnable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex h-12 items-center gap-3 rounded-md border border-[var(--lp-on-deep-line)] px-4 font-mono text-sm text-[var(--lp-on-deep)] transition-colors duration-150 hover:border-[var(--lp-on-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-on-deep)]"
    >
      {email}
      <span key={String(copied)} className="lp-swap inline-flex items-center gap-1.5 text-[var(--lp-on-deep-muted)] group-hover:text-[var(--lp-on-deep)]">
        {copied ? <Check aria-hidden strokeWidth={2} className="h-4 w-4" /> : <Copy aria-hidden strokeWidth={1.5} className="h-4 w-4" />}
        <span aria-live="polite" className="font-sans text-xs">
          {copied ? "Copié" : "Copier"}
        </span>
      </span>
    </button>
  );
}
