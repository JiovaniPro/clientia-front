"use client";

import { ArrowRight, LayoutGrid, List, Mail, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { ClientCard, ClientCardSkeleton, NextAppointmentInline, clientDisplayName } from "@/components/clients/ClientCard";
import { SendEmailModal } from "@/components/clients/SendEmailModal";
import { Button } from "@/components/ui/Button";
import { clickableRowProps, CLICKABLE_ROW_CLASS } from "@/components/ui/clickableRow";
import { EmptyState, LoadError } from "@/components/ui/ListStates";
import { PageTitle } from "@/components/ui/PageTitle";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientListItemDTO } from "@/lib/api/clients";
import { listClients } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 24;

/* ---------- Mode d'affichage (cartes / liste), mémorisé par navigateur ---------- */

type View = "cards" | "list";
const VIEW_KEY = "clientia:agent-rdv-clients-view";
const viewListeners = new Set<() => void>();

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

function writeView(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // stockage indisponible : le choix vaut pour cette page seulement
  }
  viewListeners.forEach((listener) => listener());
}

function useView(): View {
  return useSyncExternalStore(
    (listener) => {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    readView,
    () => "cards",
  );
}

/* ---------- Page ---------- */

interface Overview {
  total: number;
  statuses: { key: string; label: string; color: string | null; count: number }[];
}

/**
 * §5.26 "Mes clients" de l'Agent RDV — déjà scopé côté backend à ses propres dossiers assignés. Cartes (ou
 * liste dense) avec le prochain rendez-vous mis en avant, recherche (touche « / » pour y aller), filtres par
 * statut de dossier avec le nombre de dossiers de chacun, filtre par statut final, envoi d'e-mail depuis la
 * carte. Les statuts viennent des listes configurables de l'organisation, jamais codés en dur.
 */
export default function AgentRdvClientsPage() {
  const { authedFetch } = useAuth();
  const router = useRouter();
  const view = useView();

  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dossierKey, setDossierKey] = useState("");
  const [finalKey, setFinalKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; items: ClientListItemDTO[]; total: number; now: Date } | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [finalStatuses, setFinalStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [emailTarget, setEmailTarget] = useState<ClientListItemDTO | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const queryKey = `${page}|${search}|${dossierKey}|${finalKey}`;
  const isLoading = result?.key !== queryKey;
  const hasFilters = Boolean(search || dossierKey || finalKey);

  // Recherche : appliquée 350 ms après la dernière frappe, et on repart de la page 1.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch((current) => {
        if (current === searchInput.trim()) return current;
        setPage(1);
        return searchInput.trim();
      });
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Touche « / » : va au champ de recherche (comme sur les grands outils), sauf quand on tape déjà ailleurs.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Liste filtrée.
  useEffect(() => {
    let cancelled = false;
    authedFetch((token) =>
      listClients(
        {
          page,
          pageSize: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(dossierKey ? { dossierStatusKey: dossierKey } : {}),
          ...(finalKey ? { finalStatusKey: finalKey } : {}),
        },
        token,
      ),
    )
      .then((response) => {
        if (cancelled) return;
        setResult({ key: queryKey, items: response.items, total: response.total, now: new Date() });
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger vos dossiers clients.");
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, page, search, dossierKey, finalKey, queryKey, attempt]);

  // Vue d'ensemble : nombre de dossiers par statut (puces) — indépendante de la recherche, pour rester stable.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authedFetch((token) => getConfigurableList("CLIENT_DOSSIER_STATUS", token)),
      authedFetch((token) => getConfigurableList("CLIENT_FINAL_STATUS", token)),
    ])
      .then(async ([dossier, final]) => {
        const active = dossier.filter((s) => s.isActive).sort((a, b) => a.order - b.order);
        const count = (extra: { dossierStatusKey?: string }) =>
          authedFetch((token) => listClients({ ...extra, page: 1, pageSize: 1 }, token)).then((r) => r.total);
        const [total, ...counts] = await Promise.all([count({}), ...active.map((s) => count({ dossierStatusKey: s.key }))]);
        if (cancelled) return;
        setOverview({ total: total!, statuses: active.map((s, i) => ({ key: s.key, label: s.label, color: s.color, count: counts[i]! })) });
        setFinalStatuses(final.filter((s) => s.isActive).sort((a, b) => a.order - b.order));
      })
      .catch(() => {
        // Les puces sont un confort : sans elles, la liste et la recherche fonctionnent quand même.
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, attempt]);

  function chooseDossier(key: string) {
    setDossierKey(key);
    setPage(1);
    setError(null);
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setDossierKey("");
    setFinalKey("");
    setPage(1);
    setError(null);
    searchRef.current?.focus();
  }

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const now = result?.now ?? new Date(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = result === null && !error;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle parent="Clients">Mes clients</PageTitle>
          <p className="text-sm text-ink-muted">
            {overview
              ? `${overview.total} dossier${overview.total > 1 ? "s" : ""} dont vous êtes l'agent RDV assigné.`
              : "Les dossiers dont vous êtes l'agent RDV assigné."}
          </p>
        </div>
        <ViewToggle view={view} />
      </header>

      {/* Barre d'outils : recherche, puces de statut avec compteurs, statut final. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search aria-hidden size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Rechercher un client"
              placeholder="Nom, téléphone, e-mail…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchInput("");
              }}
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-16 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput ? (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => {
                  setSearchInput("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              >
                <X size={14} aria-hidden />
              </button>
            ) : (
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm border border-border px-1.5 font-mono text-[11px] text-ink-faint"
              >
                /
              </kbd>
            )}
          </div>

          {finalStatuses.length > 0 ? (
            <Select
              aria-label="Statut final"
              value={finalKey}
              onChange={(e) => {
                setFinalKey(e.target.value);
                setPage(1);
                setError(null);
              }}
              className="w-56"
            >
              <option value="">Tous les statuts finaux</option>
              {finalStatuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-forest-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>

        {overview && overview.statuses.length > 0 ? (
          <div role="group" aria-label="Statut du dossier" className="flex flex-wrap gap-2">
            <StatusChip label="Tous" count={overview.total} active={dossierKey === ""} onClick={() => chooseDossier("")} />
            {overview.statuses.map((s) => (
              <StatusChip
                key={s.key}
                label={s.label}
                color={s.color}
                count={s.count}
                active={dossierKey === s.key}
                onClick={() => chooseDossier(dossierKey === s.key ? "" : s.key)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Résultats */}
      {error ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          <LoadError message={error} onRetry={retry} />
        </div>
      ) : firstLoad ? (
        <div role="status" aria-label="Chargement…" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <ClientCardSkeleton key={i} />
          ))}
          <span className="sr-only">Chargement…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          {hasFilters ? (
            <EmptyState
              title={search ? `Aucun client ne correspond à « ${search} ».` : "Aucun client ne correspond à ces filtres."}
              description="Essayez un autre nom, un autre statut, ou retirez les filtres."
              action={
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  <SearchX size={14} aria-hidden />
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Aucun client ne vous est encore assigné."
              description="Les dossiers apparaissent ici dès qu'un téléphoniste vous assigne un rendez-vous."
            />
          )}
        </div>
      ) : (
        <div className={cn("transition-opacity duration-200", isLoading && "opacity-60")} aria-busy={isLoading}>
          {view === "cards" ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((client, i) => (
                <li key={client.id} className="app-rise" style={{ animationDelay: `${Math.min(i, 9) * 35}ms` }}>
                  <ClientCard client={client} now={now} onSendEmail={setEmailTarget} />
                </li>
              ))}
            </ul>
          ) : (
            <ClientTable items={items} now={now} onOpen={(c) => router.push(`/clients/${c.id}`)} onSendEmail={setEmailTarget} />
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
            <span aria-live="polite">
              {total} dossier{total > 1 ? "s" : ""}
              {hasFilters ? " correspondant" + (total > 1 ? "s" : "") : ""}
            </span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-3">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <span className="font-mono text-xs">
                  page {page} sur {totalPages}
                </span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {emailTarget ? (
        <SendEmailModal
          clientId={emailTarget.id}
          clientEmail={emailTarget.email}
          onClose={() => setEmailTarget(null)}
          onSent={() => {}}
        />
      ) : null}
    </div>
  );
}

/* ---------- Éléments ---------- */

function ViewToggle({ view }: { view: View }) {
  const option = (value: View, label: string, Icon: typeof LayoutGrid) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => writeView(value)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        view === value ? "bg-forest-600 text-white dark:text-cream" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
      )}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Affichage" className="flex gap-1 rounded-md border border-border bg-surface p-1">
      {option("cards", "Cartes", LayoutGrid)}
      {option("list", "Liste", List)}
    </div>
  );
}

/** Puce de filtre : point de couleur du statut, libellé, nombre de dossiers. Cliquer à nouveau la désactive. */
function StatusChip({
  label,
  color,
  count,
  active,
  onClick,
}: {
  label: string;
  color?: string | null;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        active ? "border-forest-600 bg-forest-50 text-ink" : "border-border bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
        !active && count === 0 && "opacity-60",
      )}
    >
      {color ? <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
      <span className={cn("font-mono text-xs tabular-nums", active ? "text-forest-600" : "text-ink-faint")}>{count}</span>
    </button>
  );
}

/** Vue liste : dense, lignes cliquables, actions révélées au survol (toujours visibles au toucher et au clavier). */
function ClientTable({
  items,
  now,
  onOpen,
  onSendEmail,
}: {
  items: ClientListItemDTO[];
  now: Date;
  onOpen: (client: ClientListItemDTO) => void;
  onSendEmail: (client: ClientListItemDTO) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-flat">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-4 py-2.5 font-medium">Téléphone</th>
            <th className="px-4 py-2.5 font-medium">Prochain RDV</th>
            <th className="px-4 py-2.5 font-medium">Dossier</th>
            <th className="px-4 py-2.5 font-medium">Statut final</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id}
              {...clickableRowProps(() => onOpen(c))}
              className={cn("group border-b border-border last:border-0 hover:bg-surface-subtle/70", CLICKABLE_ROW_CLASS)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <ClientAvatar id={c.id} firstName={c.firstName} lastName={c.lastName} className="h-9 w-9 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{clientDisplayName(c)}</p>
                    <p className="truncate text-xs text-ink-muted">{c.email ?? "Pas d'adresse e-mail"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <PhoneLink number={c.phoneNumber} className="text-sm" />
              </td>
              <td className="px-4 py-3">
                <NextAppointmentInline iso={c.nextAppointmentAt} now={now} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge label={c.dossierStatus.label} color={c.dossierStatus.color} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge label={c.finalStatus.label} color={c.finalStatus.color} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <button
                    type="button"
                    onClick={() => onSendEmail(c)}
                    disabled={!c.email}
                    aria-label={`Envoyer un e-mail à ${clientDisplayName(c)}`}
                    title={c.email ? "Envoyer un e-mail" : "Ce client n'a pas d'adresse e-mail"}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-forest-600 hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
                  >
                    <Mail size={16} aria-hidden />
                  </button>
                  <Link
                    href={`/clients/${c.id}`}
                    aria-label={`Ouvrir le dossier de ${clientDisplayName(c)}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-forest-600 hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                  >
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
