import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Coquille commune des écrans de la console Super Admin : même largeur, même rythme vertical. */
export function PlatformPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-6xl space-y-8 px-6 py-10", className)}>{children}</div>;
}

export function PlatformPageHeader({
  eyebrow = "Console Super Admin",
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0 space-y-1.5">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">{eyebrow}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function PlatformNotice({ tone, children }: { tone: "success" | "danger"; children: ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "success"
          ? "border-forest-600/30 bg-forest-600/10 text-forest-600"
          : "border-status-danger/30 bg-status-danger/10 text-status-danger",
      )}
    >
      {children}
    </p>
  );
}

/** Grand nombre au format français (espace fine insécable des milliers). */
export const formatCount = (value: number) => value.toLocaleString("fr-FR");

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
