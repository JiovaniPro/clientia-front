"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { EmailTemplateDTO } from "@/lib/api/emails";
import { createTemplate, updateTemplate } from "@/lib/api/emails";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

interface EmailTemplateFormModalProps {
  /** Présent = édition, absent = création. */
  template?: EmailTemplateDTO;
  onClose: () => void;
  onSaved: (template: EmailTemplateDTO) => void;
}

/**
 * Miroir de backend modules/emails/service.ts::buildTemplateVariables — seules variables réellement substituées
 * (syntaxe {{nom}}, objet ET contenu). À tenir à jour si cette fonction change.
 */
const TEMPLATE_VARIABLES = [
  { name: "prenom_client", description: "Prénom du client" },
  { name: "nom_client", description: "Nom du client" },
  { name: "adresse_client", description: "Adresse du client" },
  { name: "telephone_client", description: "Téléphone du client" },
  { name: "nom_organisation", description: "Nom de votre organisation" },
  {
    name: "date_rdv",
    description: "Date du rendez-vous — e-mails automatiques liés à un RDV uniquement ; vide en envoi manuel depuis un dossier",
  },
  {
    name: "heure_rdv",
    description: "Heure du rendez-vous — e-mails automatiques liés à un RDV uniquement ; vide en envoi manuel depuis un dossier",
  },
] as const;

export function EmailTemplateFormModal({ template, onClose, onSaved }: EmailTemplateFormModalProps) {
  const { authedFetch } = useAuth();
  const isEdit = Boolean(template);

  const [key, setKey] = useState(template?.key ?? "");
  const [label, setLabel] = useState(template?.label ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestClose, confirmElement } = useUnsavedChangesGuard({ key, label, subject, body }, onClose);

  // Variables cliquables : insérées au curseur du DERNIER champ actif (objet ou contenu ; contenu par défaut).
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const el = activeField === "subject" ? subjectRef.current : bodyRef.current;
    const current = activeField === "subject" ? subject : body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    (activeField === "subject" ? setSubject : setBody)(next);
    // Après le rendu : focus conservé, curseur juste après la variable insérée.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

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
    <>
    <Modal title={isEdit ? "Modifier le modèle" : "Nouveau modèle"} onClose={requestClose} closeDisabled={isSubmitting} widthClassName="max-w-lg">
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
          onFocus={() => setActiveField("subject")}
          ref={subjectRef}
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
            onFocus={() => setActiveField("body")}
            ref={bodyRef}
            rows={8}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600"
            required
          />
        </div>

        <section aria-labelledby="template-variables-title" className="rounded-md border border-border bg-surface-subtle p-3">
          <h3 id="template-variables-title" className="text-sm font-medium text-ink">
            Variables disponibles (objet et contenu)
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Cliquez pour insérer au curseur dans le champ actif ({activeField === "subject" ? "objet" : "contenu"}). Une
            variable vide est remplacée par rien.
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.name} className="contents">
                <dt>
                  <button
                    type="button"
                    // Garde le focus (et la sélection) dans l'objet ou le contenu.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v.name)}
                    className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-ink hover:border-forest-600 hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                  >
                    {`{{${v.name}}}`}
                  </button>
                </dt>
                <dd className="text-ink-muted">{v.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
    {confirmElement}
    </>
  );
}
