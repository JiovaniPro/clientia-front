"use client";

import { ChevronRight, CircleAlert, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Coquille commune des écrans de la console : même largeur, même rythme vertical. */
export function PlatformPage({ children, className, narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div className={cn("mx-auto w-full space-y-6 px-5 py-7 sm:px-8 sm:py-9", narrow ? "max-w-2xl" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}

export interface Crumb {
  href: string;
  label: string;
}

/**
 * En-tête d'écran : fil d'Ariane facultatif (remplace les liens « ← retour »), titre, ligne de contexte
 * (statut, identifiant, compteurs) et actions principales à droite. Pas de surtitre : le rail dit déjà où l'on est.
 */
export function PlatformPageHeader({
  crumbs,
  title,
  badge,
  description,
  actions,
}: {
  crumbs?: Crumb[];
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Fil d'Ariane">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            {crumbs.map((crumb) => (
              <li key={crumb.href} className="flex items-center gap-1">
                <Link
                  href={crumb.href}
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  {crumb.label}
                </Link>
                <ChevronRight size={14} aria-hidden className="text-ink-faint" />
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-ink [text-wrap:balance]">{title}</h1>
            {badge}
          </div>
          {description ? <div className="text-sm text-ink-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Message de résultat d'une action, refermable. `danger` est annoncé immédiatement (role="alert"). */
export function PlatformNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: "success" | "danger";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "app-rise flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm text-ink",
        tone === "success" ? "border-forest-600/30 bg-forest-50" : "border-status-danger/35 bg-status-danger/10",
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className={cn("mt-0.5 shrink-0", tone === "success" ? "text-forest-600" : "text-status-danger")}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message"
          className="-m-1 rounded-sm p-1 text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export type OrganizationState = "active" | "suspended" | "deleted";

export function organizationState(org: { isActive: boolean; deletedAt: string | null }): OrganizationState {
  if (org.deletedAt) return "deleted";
  return org.isActive ? "active" : "suspended";
}

const STATE_STYLE: Record<OrganizationState, { label: string; className: string; dot: string }> = {
  active: { label: "Active", className: "border-forest-600/30 bg-forest-50 text-forest-600", dot: "bg-forest-600" },
  suspended: { label: "Suspendue", className: "border-status-danger/35 bg-status-danger/10 text-status-danger", dot: "bg-status-danger" },
  deleted: { label: "Supprimée", className: "border-border bg-surface-subtle text-ink-muted", dot: "bg-ink-faint" },
};

/** Statut d'une organisation : pastille ET libellé (jamais la couleur seule). */
export function OrganizationStatusBadge({ state, className }: { state: OrganizationState; className?: string }) {
  const style = STATE_STYLE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

/** Grand nombre au format français (espace fine insécable des milliers). */
export const formatCount = (value: number) => value.toLocaleString("fr-FR");

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** « 3 utilisateurs », « 1 utilisateur », « aucun utilisateur ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`, none?: string) {
  if (count === 0 && none) return none;
  return `${formatCount(count)} ${count > 1 ? pluralForm : singular}`;
}
