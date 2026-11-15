"use client";

import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

/**
 * Organisation ouverte, en tête du rail gauche. Quand la session donne accès à plusieurs organisations
 * (même e-mail, mot de passe vérifié à la connexion), un clic ouvre la liste et permet d'en changer sans se
 * déconnecter. Une seule organisation : simple libellé, rien à ouvrir.
 */
export function OrganizationSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { user, organizations, switchOrganization } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const canSwitch = organizations.length > 1;
  const name = user.organization.name;

  async function choose(slug: string) {
    setError(null);
    setPending(slug);
    try {
      await switchOrganization(slug); // recharge la page en cas de succès
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Changement d'organisation impossible.");
      setPending(null);
    }
  }

  const label = (
    <>
      <Building2 size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-ink-muted" />
      {collapsed ? null : <span className="min-w-0 flex-1 truncate text-left font-medium text-ink">{name}</span>}
      {canSwitch && !collapsed ? <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-ink-faint" /> : null}
    </>
  );
  const boxClass = cn("flex h-10 w-full items-center gap-2.5 rounded-md text-sm", collapsed ? "justify-center" : "px-2.5");

  return (
    <div ref={rootRef} className="relative mb-3">
      {canSwitch ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Organisation : ${name} — changer d'organisation`}
          title={collapsed ? `${name} — changer d'organisation` : undefined}
          className={cn(
            boxClass,
            "border border-border transition-colors hover:border-ink-faint hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
          )}
        >
          {label}
        </button>
      ) : (
        <div className={boxClass} title={collapsed ? name : undefined} aria-label={`Organisation : ${name}`}>
          {label}
        </div>
      )}

      {open ? (
        <div
          role="menu"
          aria-label="Changer d'organisation"
          className={cn(
            "app-rise absolute top-full z-40 mt-1.5 w-60 rounded-lg border border-border bg-surface p-1 shadow-raised",
            collapsed ? "left-0" : "left-0 right-0 w-auto",
          )}
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-ink-faint">Vos organisations</p>
          {organizations.map((org) => (
            <button
              key={org.slug}
              type="button"
              role="menuitem"
              disabled={org.current || pending !== null}
              aria-current={org.current ? "true" : undefined}
              onClick={() => void choose(org.slug)}
              className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.current ? <Check size={15} aria-hidden className="shrink-0 text-forest-600" /> : null}
              {pending === org.slug ? <Loader2 size={15} aria-hidden className="shrink-0 animate-spin text-ink-muted" /> : null}
            </button>
          ))}
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-status-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
