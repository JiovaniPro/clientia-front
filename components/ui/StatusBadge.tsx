import { cn } from "@/lib/cn";

interface StatusBadgeProps {
  label: string;
  /** Couleur venant de `ConfigurableListItem.color` — jamais un enum codé en dur, voir §4 du plan. */
  color?: string | null;
  variant?: "dot" | "outline";
  className?: string;
}

const FALLBACK_COLOR = "var(--color-status-neutral)";

/** Le point (`rounded-full`) est l'exception autorisée aux pastilles — le conteneur du badge, lui, reste `rounded-md`. */
export function StatusBadge({ label, color, variant = "dot", className }: StatusBadgeProps) {
  const dotColor = color ?? FALLBACK_COLOR;

  if (variant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium",
          className,
        )}
        style={{ borderColor: dotColor, color: dotColor }}
      >
        {label}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-ink", className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />
      {label}
    </span>
  );
}
