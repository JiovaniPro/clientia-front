"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTable, type AdminTableColumn } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmailTemplateFormModal } from "@/components/admin/EmailTemplateFormModal";
import { ApiError } from "@/lib/api/client";
import type { EmailTemplateDTO } from "@/lib/api/emails";
import { deleteTemplate, listTemplates, updateTemplate } from "@/lib/api/emails";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Onglet Modèles, §5.12 sous-lot 2 (lecture, création, édition, activer/désactiver,
 * suppression). "Désactiver" (isActive:false) reste la voie normale pour retirer un
 * modèle du choix à l'envoi sans rien perdre ; "Supprimer" est une suppression
 * physique, bloquée côté backend si le modèle a déjà servi à un envoi réel
 * (EmailHistory.emailTemplateId) — message backend affiché tel quel, jamais
 * re-deviné ici (même logique que §5.22).
 */
export function EmailTemplatesTab() {
  const { authedFetch } = useAuth();

  const [templates, setTemplates] = useState<EmailTemplateDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; template: EmailTemplateDTO } | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTemplates(await authedFetch((token) => listTemplates(token)));
    } catch {
      setError("Impossible de charger les modèles d'e-mail.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function upsertTemplate(updated: EmailTemplateDTO) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      return exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [...prev, updated];
    });
  }

  function handleSaved(saved: EmailTemplateDTO) {
    const wasCreate = modal?.mode === "create";
    setModal(null);
    upsertTemplate(saved);
    setNotice(wasCreate ? `« ${saved.label} » créé.` : "Modèle mis à jour.");
  }

  async function handleToggleActive(template: EmailTemplateDTO) {
    setError(null);
    setNotice(null);
    setPendingId(template.id);
    try {
      const updated = await authedFetch((token) =>
        updateTemplate(template.id, { isActive: !template.isActive }, token),
      );
      upsertTemplate(updated);
      setNotice(updated.isActive ? `« ${updated.label} » réactivé.` : `« ${updated.label} » désactivé.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(template: EmailTemplateDTO) {
    setError(null);
    setNotice(null);
    setPendingId(template.id);
    try {
      await authedFetch((token) => deleteTemplate(template.id, token));
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      setNotice(`« ${template.label} » supprimé.`);
    } catch (err) {
      // Le garde-fou vient de la contrainte de clé étrangère côté base (modèle déjà
      // référencé par un envoi) — message backend affiché tel quel.
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPendingId(null);
    }
  }

  const columns: AdminTableColumn<EmailTemplateDTO>[] = [
    { header: "Libellé", className: "text-ink", cell: (t) => t.label },
    { header: "Clé", className: "font-mono text-xs text-ink-faint", cell: (t) => t.key },
    { header: "Objet", className: "text-ink-muted", cell: (t) => t.subject },
    {
      header: "Statut",
      cell: (t) => (
        <StatusBadge
          label={t.isActive ? "Actif" : "Inactif"}
          color={t.isActive ? "var(--color-forest-600)" : "var(--color-ink-faint)"}
        />
      ),
    },
    {
      header: "",
      className: "text-right",
      cell: (t) => (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="text-xs font-medium text-forest-600 hover:underline"
            onClick={() => setModal({ mode: "edit", template: t })}
          >
            Modifier
          </button>
          <button
            type="button"
            className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
            onClick={() => handleToggleActive(t)}
            disabled={pendingId === t.id}
          >
            {t.isActive ? "Désactiver" : "Réactiver"}
          </button>
          <button
            type="button"
            className="text-xs font-medium text-status-danger hover:underline disabled:opacity-50"
            onClick={() => handleDelete(t)}
            disabled={pendingId === t.id}
          >
            Supprimer
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Désactiver un modèle le retire du choix à l&apos;envoi sans toucher à l&apos;historique. Supprimer est
          définitif et bloqué si le modèle a déjà servi à un envoi réel.
        </p>
        <Button onClick={() => setModal({ mode: "create" })}>Nouveau modèle</Button>
      </div>

      {notice ? (
        <p className="rounded-md border border-forest-600/30 bg-forest-600/10 px-3 py-2 text-sm text-forest-600">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      ) : null}

      <AdminTable
        columns={columns}
        rows={templates}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="Aucun modèle d'e-mail."
      />

      {modal ? (
        <EmailTemplateFormModal
          template={modal.mode === "edit" ? modal.template : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
