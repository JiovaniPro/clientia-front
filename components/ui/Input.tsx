"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends ComponentProps<"input"> {
  label?: string;
  error?: string;
}

/** `type="password"` ajoute d'office un bouton œil afficher/masquer — tous les champs mot de passe du projet en héritent. */
export function Input({ label, error, className, id, type, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  const input = (
    <input
      id={inputId}
      type={isPassword && revealed ? "text" : type}
      className={cn(
        "h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint",
        "focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600",
        error && "border-status-danger focus:ring-status-danger focus:border-status-danger",
        isPassword && "w-full pr-10",
        className,
      )}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={revealed}
            aria-controls={inputId}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            {revealed ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
      ) : (
        input
      )}
      {error ? <span className="text-sm text-status-danger">{error}</span> : null}
    </div>
  );
}
