"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { EmailTemplateDTO } from "@/lib/api/emails";
import { createTemplate, updateTemplate } from "@/lib/api/emails";
import { useAuth } from "@/lib/auth/AuthContext";

interface EmailTemplateFormModalProps {
  /** Présent = édition, absent = création. */
  template?: EmailTemplateDTO;
  onClose: () => void;
  onSaved: (template: EmailTemplateDTO) => void;
}

export function EmailTemplateFormModal({ template, onClose, onSaved }: EmailTemplateFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(template);

  const [key, setKey] = useState(template?.key ?? "");
  const [label, setLabel] = useState(template?.label ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!key.trim() || !label.trim() || !subject.trim() || !body.trim()) {
      setError("La clé, le libellé, l'objet et le contenu sont obligatoires.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEdit && template) {
        const updated = await authedFetch((token) => updateTemplate(template.id, { label, subject, body }, token));
        onSaved(updated);
      } else {
        const created = await authedFetch((token) => createTemplate({ key, label, subject, body }, token));
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? "Modifier le modèle" : "Nouveau modèle"} onClose={onClose} widthClassName="max-w-lg">
      <div className="space-y-4">
        <Input
          label="Clé (identifiant stable, non modifiable ensuite)"
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          disabled={isEdit}
          required
        />
        <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <Input
          label="Objet"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Bonjour {{prenom_client}}"
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email-template-body" className="text-sm font-medium text-ink">
            Contenu
          </label>
          <textarea
            id="email-template-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600"
            required
          />
        </div>

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
