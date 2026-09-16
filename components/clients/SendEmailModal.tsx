"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api/client";
import type { EmailHistoryDTO, EmailPreviewDTO, EmailTemplateDTO } from "@/lib/api/emails";
import { listTemplates, previewEmail, sendEmail } from "@/lib/api/emails";
import { useAuth } from "@/lib/auth/AuthContext";

interface SendEmailModalProps {
  clientId: string;
  /** Un dossier sans e-mail ne peut recevoir aucun envoi — le backend le refuse de
   * toute façon (§5.12), mais l'écran l'affiche d'emblée plutôt que de laisser
   * choisir un modèle pour rien. */
  clientEmail: string | null;
  onClose: () => void;
  onSent: (history: EmailHistoryDTO) => void;
}

/**
 * §5.12 sous-lot 4 — modale d'envoi manuel depuis le dossier client, avec aperçu
 * des variables rendues AVANT envoi (POST /emails/preview, aucune écriture) pour
 * que l'agent voie exactement ce qui partira. Destinataire limité à ce client
 * précis (arbitrage validé) — pas de champ destinataire libre. Un échec SMTP
 * (statut FAILED) reste une trace non-bloquante : `onSent` est appelé dans les
 * deux cas, l'écran affiche le statut réel plutôt que de le masquer.
 */
export function SendEmailModal({ clientId, clientEmail, onClose, onSent }: SendEmailModalProps) {
  const { authedFetch } = useAuth();

  const [templates, setTemplates] = useState<EmailTemplateDTO[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [preview, setPreview] = useState<EmailPreviewDTO | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState<EmailHistoryDTO | null>(null);

  useEffect(() => {
    authedFetch((token) => listTemplates(token))
      .then((all) => setTemplates(all.filter((t) => t.isActive)))
      .catch(() => setPreviewError("Impossible de charger les modèles d'e-mail."))
      .finally(() => setIsLoadingTemplates(false));
  }, [authedFetch]);

  useEffect(() => {
    if (!templateKey || !clientEmail) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setIsLoadingPreview(true);
    setPreviewError(null);
    authedFetch((token) => previewEmail({ clientId, templateKey }, token))
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof ApiError ? err.message : "Aperçu indisponible.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, clientId, templateKey, clientEmail]);

  async function handleSend() {
    if (!templateKey) return;
    setSendError(null);
    setIsSending(true);
    try {
      const history = await authedFetch((token) => sendEmail({ clientId, templateKey }, token));
      setSentResult(history);
      onSent(history);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal title="Envoyer un e-mail" onClose={onClose} widthClassName="max-w-lg">
      <div className="space-y-4">
        {!clientEmail ? (
          <p className="rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            Ce client n&apos;a pas d&apos;adresse e-mail — impossible d&apos;envoyer.
          </p>
        ) : sentResult ? (
          <>
            <p
              className={
                sentResult.status === "SENT"
                  ? "rounded-md border border-status-success/30 bg-status-success/10 px-3 py-2 text-sm text-status-success"
                  : "rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
              }
            >
              {sentResult.status === "SENT"
                ? `Envoyé à ${sentResult.recipientEmail}.`
                : `Échec de l'envoi à ${sentResult.recipientEmail} — tracé dans l'historique, aucun renvoi automatique.`}
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Fermer</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-muted">
              Destinataire : <span className="font-mono text-ink">{clientEmail}</span>
            </p>

            <Select
              label="Modèle"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              disabled={isLoadingTemplates}
            >
              <option value="">{isLoadingTemplates ? "Chargement…" : "Choisir un modèle"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>

            {templateKey ? (
              <div className="space-y-2 rounded-md border border-border bg-surface-subtle p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Aperçu</p>
                {isLoadingPreview ? (
                  <p className="text-sm text-ink-muted">Chargement de l&apos;aperçu…</p>
                ) : previewError ? (
                  <p className="text-sm text-status-danger">{previewError}</p>
                ) : preview ? (
                  <div className="space-y-2">
                    <p className="text-sm text-ink">
                      <span className="text-ink-muted">Objet : </span>
                      {preview.subject}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-ink">{preview.body}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {sendError ? <p className="text-sm text-status-danger">{sendError}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={isSending}>
                Annuler
              </Button>
              <Button onClick={handleSend} disabled={!templateKey || !preview || isSending}>
                {isSending ? "Envoi…" : "Envoyer"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
