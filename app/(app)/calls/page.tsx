"use client";

import { Download, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WaveBadge } from "@/components/calls/WaveBadge";
import { QualifyCallModal } from "@/components/calls/QualifyCallModal";
import { NewCallModal } from "@/components/calls/NewCallModal";
import { ImportCallsModal } from "@/components/calls/ImportCallsModal";
import type { CallDTO, CallType, ListCallsFilters } from "@/lib/api/calls";
import { listCalls } from "@/lib/api/calls";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;
const CALL_TYPES: CallType[] = ["PROSPECTION", "SUPPORT", "FOLLOW_UP", "OTHER"];

function formatOccurredAt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function CallsPage() {
  const { authedFetch } = useAuth();

  const [statuses, setStatuses] = useState<ConfigurableListItemDTO[]>([]);
  const [calls, setCalls] = useState<CallDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [waveNumber, setWaveNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [qualifyingCall, setQualifyingCall] = useState<CallDTO | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  /**
   * §P0.2 : "À appeler" ne montre QUE le statut neutre (le défaut de CALL_STATUS,
   * "À contacter" dans le seed) — pas un filtre optionnel parmi d'autres. Gap
   * corrigé : avant, cet écran n'appliquait aucun filtre de statut par défaut, un
   * appel qualifié (ex. "RDV pris") restait donc visible ici indéfiniment. La clé
   * réelle dépend de la config de l'organisation, jamais codée en dur.
   */
  const neutralStatusKey = statuses.find((s) => s.isDefault)?.key;

  // Débounce de la recherche — évite une requête par frappe.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    authedFetch((token) => getConfigurableList("CALL_STATUS", token))
      .then(setStatuses)
      .catch(() => setError("Impossible de charger les statuts."));
  }, [authedFetch]);

  const fetchCalls = useCallback(async () => {
    if (!neutralStatusKey) return;
    setIsLoading(true);
    setError(null);
    const filters: ListCallsFilters = {
      page,
      pageSize: PAGE_SIZE,
      statusKey: neutralStatusKey,
      sort: "queue",
      ...(type ? { type: type as CallType } : {}),
      ...(waveNumber ? { waveNumber: Number(waveNumber) } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(search ? { search } : {}),
    };
    try {
      const response = await authedFetch((token) => listCalls(filters, token));
      setCalls(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger la file d'appels.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, neutralStatusKey, type, waveNumber, from, to, search]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Tout changement de filtre revient à la page 1.
  useEffect(() => {
    setPage(1);
  }, [type, waveNumber, from, to, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.5</p>
          <h1 className="font-display text-2xl font-bold text-ink">À appeler</h1>
          <p className="text-sm text-ink-muted">
            Uniquement les appels au statut neutre, triés vague → nom → prénom. Un appel qualifié disparaît d'ici et
            rejoint le Journal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <Download size={16} className="mr-1.5" />
            Importer
          </Button>
          <Button onClick={() => setShowNewCallModal(true)}>
            <Plus size={16} className="mr-1.5" />
            Nouvel appel
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Recherche"
            placeholder="Nom, téléphone, notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-40">
          <option value="">Tous</option>
          {CALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          label="Vague"
          type="number"
          value={waveNumber}
          onChange={(e) => setWaveNumber(e.target.value)}
          className="w-24"
        />
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : calls.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Aucun appel ne correspond à ces filtres.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Vague</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium">Le</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                  <td className="px-4 py-2.5">
                    <WaveBadge waveNumber={call.waveNumber} />
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {call.firstName || call.lastName ? `${call.firstName ?? ""} ${call.lastName ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-forest-600">{call.toNumber}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{call.type}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={call.status.label} color={call.status.color} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatOccurredAt(call.occurredAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setQualifyingCall(call)}>
                      Qualifier
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
          <span>{total} appel{total > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="font-mono text-xs">
              page {page} sur {totalPages}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {qualifyingCall ? (
        <QualifyCallModal
          call={qualifyingCall}
          statuses={statuses}
          onClose={() => setQualifyingCall(null)}
          onSaved={() => {
            setQualifyingCall(null);
            fetchCalls();
          }}
        />
      ) : null}

      {showNewCallModal ? (
        <NewCallModal
          statuses={statuses}
          onClose={() => setShowNewCallModal(false)}
          onCreated={() => {
            setShowNewCallModal(false);
            fetchCalls();
          }}
        />
      ) : null}

      {showImportModal ? (
        <ImportCallsModal onClose={() => setShowImportModal(false)} onImported={fetchCalls} />
      ) : null}
    </div>
  );
}
