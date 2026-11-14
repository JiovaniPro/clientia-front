"use client";

import { Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface RowMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Action destructive : texte et survol à la couleur d'erreur. */
  danger?: boolean;
  disabled?: boolean;
  /** Pourquoi l'action est indisponible (affiché au survol). */
  hint?: string;
}

/**
 * Menu « plus d'actions » d'une ligne ou d'une carte : garde l'écran calme (une seule icône) tout en laissant
 * toutes les actions à portée. Flèches haut/bas pour naviguer, Échap ou clic ailleurs pour fermer, et le focus
 * revient sur le bouton. Les actions indisponibles restent visibles, grisées, avec leur raison.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const entries = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      const index = entries.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      entries[(next + entries.length) % entries.length]?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title="Plus d'actions"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
          open && "bg-surface-subtle text-ink",
        )}
      >
        <Ellipsis size={18} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="app-rise absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-surface p-1 shadow-raised"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.hint}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger
                    ? "text-status-danger hover:bg-status-danger/10 focus-visible:bg-status-danger/10"
                    : "text-ink hover:bg-surface-subtle focus-visible:bg-surface-subtle",
                )}
              >
                {Icon ? <Icon size={16} aria-hidden className={item.danger ? "" : "text-ink-muted"} /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
