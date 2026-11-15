"use client";

import { Check, Copy, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DeleteOrganizationModal } from "@/components/platform/DeleteOrganizationModal";
import { formatDate, organizationState, OrganizationStatusBadge, plural } from "@/components/platform/PlatformPage";
import { Button, buttonClassName } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadError } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO, PlatformOrganizationSummaryDTO } from "@/lib/api/platformOrganizations";
import { deleteOrganization, getOrganization, setOrganizationStatus } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { cn } from "@/lib/cn";

/** Copie l'identifiant ; l'icône passe à la coche une seconde et demie (retour sans message qui encombre). */
export function CopySlug({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(slug);
          setCopied(true);
        } catch {
          // presse-papiers indisponible (contexte non sécurisé) : rien à signaler, l'identifiant reste lisible
        }
      }}
      title={copied ? "Copié" : "Copier l'identifiant"}
      aria-label={copied ? `Identifiant ${slug} copié` : `Copier l'identifiant ${slug}`}
      className="group inline-flex items-center gap-1.5 rounded-sm font-mono text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      {slug}
      {copied ? (
        <Check size={12} strokeWidth={2.5} aria-hidden className="text-forest-600" />
      ) : (
        <Copy size={12} aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}
    </button>
  );
}

function initialsOf(firstName: string | null, lastName: string | null, email: string) {
  const fromName = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`;
  return (fromName || email[0] || "?").toUpperCase();
}

function PanelSkeleton() {
  return (
    <div role="status" aria-label="Chargement…" className="space-y-5 p-5">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-sm bg-surface-subtle" />
        <div className="h-4 w-32 animate-pulse rounded-sm bg-surface-subtle" />
      </div>
      <div className="h-9 w-full animate-pulse rounded-md bg-surface-subtle" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-4 flex-1 animate-pulse rounded-sm bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}

interface OrganizationPanelProps {
  organizationId: string;
  onClose: () => void;
  /** Statut changé ou organisation supprimée : la liste se met à jour sans recharger. */
  onChanged: (organization: PlatformOrganizationSummaryDTO) => void;
}

/**
 * Fiche latérale de la liste des organisations (écrans larges) : statut, identifiant, actions et utilisateurs,
 * sans quitter la liste. Mêmes règles que la fiche complète : seule la suspension est confirmée, seule une
 * organisation suspendue peut être supprimée, une organisation supprimée est en lecture seule.
 */
export function OrganizationPanel({ organizationId, onClose, onChanged }: OrganizationPanelProps) {
  const { authedFetch } = usePlatformAuth();
  const [organization, setOrganization] = useState<PlatformOrganizationDetailDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOrganization(null);
    setLoadError(null);
    setError(null);
    setNotice(null);
    try {
      setOrganization(await authedFetch((token) => getOrganization(organizationId, token)));
    } catch {
      setLoadError("Impossible de charger cette organisation.");
    }
  }, [authedFetch, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus() {
    if (!organization) return;
    setError(null);
    setNotice(null);
    setIsToggling(true);
    try {
      const updated = await authedFetch((token) => setOrganizationStatus(organization.id, !organization.isActive, token));
      setOrganization(updated);
      onChanged(updated);
      setNotice(updated.isActive ? "Réactivée — accès restauré immédiatement." : "Suspendue — accès coupé, sessions révoquées.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsToggling(false);
      setShowSuspendConfirm(false);
    }
  }

  async function handleDelete(confirmName: string) {
    if (!organization) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const deleted = await authedFetch((token) => deleteOrganization(organization.id, confirmName, token));
      setShowDelete(false);
      onChanged(deleted);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsDeleting(false);
    }
  }

  const state = organization ? organizationState(organization) : null;
  const activeUsers = organization?.users.filter((u) => u.isActive).length ?? 0;

  return (
    <aside
      aria-label={organization ? `Fiche : ${organization.name}` : "Fiche de l'organisation"}
      className="app-rise flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-raised"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-sm font-medium text-ink-muted">Fiche de l&apos;organisation</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          title="Fermer (Échap)"
          className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {loadError ? (
        <LoadError message={loadError} onRetry={load} />
      ) : !organization || !state ? (
        <PanelSkeleton />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{organization.name}</h2>
                <OrganizationStatusBadge state={state} />
              </div>
              <CopySlug slug={organization.slug} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-surface-subtle/70 px-3 py-2">
                <dt className="text-xs text-ink-muted">Utilisateurs</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {organization._count.users}
                  {organization._count.users > 0 ? <span className="font-normal text-ink-muted"> · {activeUsers} actif{activeUsers > 1 ? "s" : ""}</span> : null}
                </dd>
              </div>
              <div className="rounded-md bg-surface-subtle/70 px-3 py-2">
                <dt className="text-xs text-ink-muted">{state === "deleted" ? "Supprimée le" : "Créée le"}</dt>
                <dd className="mt-0.5 font-semibold text-ink">{formatDate(organization.deletedAt ?? organization.createdAt)}</dd>
              </div>
            </dl>

            {notice ? (
              <p role="status" className="app-rise flex items-center gap-2 text-sm text-forest-600">
                <Check size={14} strokeWidth={2.5} aria-hidden />
                {notice}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-status-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {state === "deleted" ? null : (
                <Button
                  size="sm"
                  variant={organization.isActive ? "secondary" : "primary"}
                  className={organization.isActive ? "hover:text-status-danger" : undefined}
                  onClick={() => (organization.isActive ? setShowSuspendConfirm(true) : toggleStatus())}
                  disabled={isToggling}
                  aria-busy={isToggling}
                >
                  {organization.isActive ? "Suspendre" : isToggling ? "Réactivation…" : "Réactiver"}
                </Button>
              )}
              {state === "suspended" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-status-danger hover:text-status-danger"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDelete(true);
                  }}
                >
                  Supprimer
                </Button>
              ) : null}
              <Link href={`/platform/organizations/${organization.id}`} className={cn(buttonClassName({ variant: "ghost", size: "sm" }), "ml-auto")}>
                Fiche complète
                <ExternalLink size={14} aria-hidden />
              </Link>
            </div>
          </div>

          <section aria-labelledby="panel-users" className="border-t border-border">
            <h3 id="panel-users" className="px-5 pb-1 pt-4 text-sm font-semibold text-ink">
              Utilisateurs <span className="font-normal text-ink-muted">· {plural(organization._count.users, "compte", "comptes", "aucun")}</span>
            </h3>
            {organization.users.length === 0 ? (
              <p className="px-5 pb-5 pt-1 text-sm text-ink-muted">Aucun utilisateur dans cette organisation.</p>
            ) : (
              <ul className="px-2 pb-3">
                {organization.users.map((u) => {
                  const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                  return (
                    <li key={u.id} className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-subtle">
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          u.isActive ? "bg-forest-50 text-forest-600" : "bg-surface-subtle text-ink-faint",
                        )}
                      >
                        {initialsOf(u.firstName, u.lastName, u.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", u.isActive ? "text-ink" : "text-ink-muted")}>{fullName || u.email}</span>
                        <span className="block truncate text-xs text-ink-muted">{fullName ? u.email : u.role.name}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block text-ink-muted">{u.role.name}</span>
                        {u.isActive ? null : <span className="block text-ink-faint">Désactivé</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {showSuspendConfirm && organization ? (
        <ConfirmModal
          title="Suspendre cette organisation"
          message={`Suspendre « ${organization.name} » ? ${organization._count.users} utilisateur${organization._count.users > 1 ? "s" : ""} actif${organization._count.users > 1 ? "s" : ""} ${organization._count.users > 1 ? "perdront" : "perdra"} l'accès immédiatement et leurs sessions en cours seront révoquées.`}
          confirmLabel="Suspendre"
          onConfirm={toggleStatus}
          onClose={() => setShowSuspendConfirm(false)}
          isConfirming={isToggling}
        />
      ) : null}
      {showDelete && organization ? (
        <DeleteOrganizationModal
          organizationName={organization.name}
          userCount={organization._count.users}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
          isConfirming={isDeleting}
          error={deleteError}
        />
      ) : null}
    </aside>
  );
}
