"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EmailHistoryDTO, EmailStatus, EmailTemplateDTO } from "@/lib/api/emails";
import { listHistory, listTemplates } from "@/lib/api/emails";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<EmailStatus, string> = {
  SENT: "Envoyé",
  FAILED: "Échec",
  PENDING: "En attente",
};
const STATUS_COLORS: Record<EmailStatus, string> = {
  SENT: "var(--color-status-success)",
  FAILED: "var(--color-status-danger)",
  PENDING: "var(--color-status-warning)",
};

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined, fallback: string) {
  if (!p) return fallback;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || fallback;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Onglet Historique, §5.12 sous-lot 3 — lecture seule, filtrable (statut, modèle,
 * période). Pas d'action possible ici (pas de renvoi, pas de suppression) :
 * l'historique est une trace, jamais modifiée après coup.
 */
export function EmailHistoryTab() {
  const { authedFetch } = useAuth();

  const [templates, setTemplates] = useState<EmailTemplateDTO[]>([]);
  const [rows, setRows] = useState<EmailHistoryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<EmailStatus | "">("");
  const [templateKey, setTemplateKey] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    authedFetch((token) => listTemplates(token))
      .then(setTemplates)
      .catch(() => {});
  }, [authedFetch]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authedFetch((token) =>
        listHistory(
          {
            page,
            pageSize: PAGE_SIZE,
            ...(status ? { status } : {}),
            ...(templateKey ? { templateKey } : {}),
            ...(from ? { from: new Date(from).toISOString() } : {}),
            ...(to ? { to: new Date(to).toISOString() } : {}),
          },
          token,
        ),
      );
      setRows(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger l'historique des e-mails.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, status, templateKey, from, to]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [status, templateKey, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: AdminTableColumn<EmailHistoryDTO>[] = [
    { header: "Le", className: "text-ink-muted", cell: (h) => formatDateTime(h.createdAt) },
    { header: "Destinataire", className: "text-ink", cell: (h) => personLabel(h.client, h.recipientEmail) },
    { header: "Adresse", className: "font-mono text-xs text-ink-faint", cell: (h) => h.recipientEmail },
    { header: "Modèle", className: "text-ink-muted", cell: (h) => h.templateKeySnapshot },
    { header: "Objet", className: "text-ink-muted", cell: (h) => h.subject },
    { header: "Envoyé par", className: "text-ink-muted", cell: (h) => personLabel(h.agentCalliste, "—") },
    {
      header: "Statut",
      cell: (h) => <StatusBadge label={STATUS_LABELS[h.status]} color={STATUS_COLORS[h.status]} />,
    },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Trace de tous les envois réels — automatiques et manuels. Un échec SMTP reste tracé ici (statut « Échec »),
        sans bloquer l&apos;écran d&apos;envoi.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <Select
          label="Statut"
          value={status}
          onChange={(e) => setStatus(e.target.value as EmailStatus | "")}
          className="w-40"
        >
          <option value="">Tous</option>
          {(Object.keys(STATUS_LABELS) as EmailStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select label="Modèle" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className="w-56">
          <option value="">Tous</option>
          {templates.map((t) => (
            <option key={t.id} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-flat">
        {error ? (
          <p className="p-6 text-sm text-status-danger">{error}</p>
        ) : (
          <AdminTable
            columns={columns}
            rows={rows}
            rowKey={(h) => h.id}
            isLoading={isLoading}
            emptyMessage="Aucun envoi ne correspond à ces filtres."
          />
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
          <span>
            {total} envoi{total > 1 ? "s" : ""}
          </span>
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
    </div>
  );
}
