"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import type { AuditLogDTO } from "@/lib/api/auditLogs";
import { AUDIT_ACTION_LABELS, listAuditLogs } from "@/lib/api/auditLogs";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

const PAGE_SIZE = 50;

function personLabel(u: { firstName: string | null; lastName: string | null; email: string }) {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

/** Journal d'audit de l'organisation — lecture seule, gate `auditLog.view` (GET /audit-logs). */
export default function AdminAuditPage() {
  const { authedFetch } = useAuth();

  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserListItemDTO[]>([]);

  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    authedFetch((token) => listUsers({}, token))
      .then(setUsers)
      .catch(() => setError("Impossible de charger les utilisateurs."));
  }, [authedFetch]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authedFetch((token) =>
        listAuditLogs(
          {
            page,
            pageSize: PAGE_SIZE,
            action: action || undefined,
            userId: userId || undefined,
            from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
            to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
          },
          token,
        ),
      );
      setLogs(response.items);
      setTotal(response.total);
    } catch {
      setError("Impossible de charger le journal d'audit.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, page, action, userId, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Tout changement de filtre revient à la page 1.
  useEffect(() => {
    setPage(1);
  }, [action, userId, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: AdminTableColumn<AuditLogDTO>[] = [
    {
      header: "Date",
      className: "whitespace-nowrap font-mono text-xs text-ink-muted",
      cell: (l) => new Date(l.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }),
    },
    { header: "Utilisateur", className: "text-ink", cell: (l) => (l.user ? personLabel(l.user) : "—") },
    { header: "Action", className: "text-ink", cell: (l) => AUDIT_ACTION_LABELS[l.action] ?? l.action },
    {
      header: "Élément",
      className: "text-ink-muted",
      cell: (l) => (
        <>
          {l.entity}
          {l.entityId ? <span className="ml-1.5 font-mono text-xs text-ink-faint">{l.entityId}</span> : null}
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
        <h1 className="font-display text-2xl font-bold text-ink">Journal d&apos;audit</h1>
        <p className="text-sm text-ink-muted">Qui a fait quoi dans l&apos;organisation, du plus récent au plus ancien.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-flat">
        <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} className="w-64">
          <option value="">Toutes</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select label="Utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-56">
          <option value="">Tous</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {personLabel(u)}
            </option>
          ))}
        </Select>
        <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <AdminTable
        columns={columns}
        rows={logs}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        emptyMessage="Aucune entrée ne correspond à ces filtres."
      />

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>
          {total} entrée{total > 1 ? "s" : ""}
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
  );
}
