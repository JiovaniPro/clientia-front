"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO } from "@/lib/api/platformOrganizations";
import { createOrganization } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

interface OrganizationFormModalProps {
  onClose: () => void;
  onSaved: (organization: PlatformOrganizationDetailDTO) => void;
}

/** Même règle que le serveur (modules/organizations/schema.ts). */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

/** « Cabinet Dupont & Fils » → « cabinet-dupont-fils » : accents retirés, tout le reste devient un tiret. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

type Field = "organizationName" | "organizationSlug" | "adminEmail";

/**
 * Création uniquement — même provisioning que l'auto-inscription publique (voir
 * organizations/service.ts::createOrganization), juste déclenchée par un Super
 * Admin plutôt qu'un visiteur. Pas de mot de passe : le premier admin reçoit un
 * e-mail d'invitation et définit le sien, comme un utilisateur ajouté via /admin/users. Pas d'édition ici : §5.24 (déjà livré) couvre déjà
 * la modification du nom/logo/couleur, depuis l'écran organisation de l'organisation
 * elle-même — pas de deuxième porte d'entrée qui le dupliquerait.
 *
 * L'identifiant suit le nom tant qu'il n'a pas été modifié à la main ; les erreurs s'affichent sous chaque
 * champ, à la soumission puis au fil de la correction.
 */
export function OrganizationFormModal({ onClose, onSaved }: OrganizationFormModalProps) {
  const { authedFetch } = usePlatformAuth();

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestClose, confirmElement } = useUnsavedChangesGuard(
    { organizationName, organizationSlug, adminEmail, adminFirstName, adminLastName },
    onClose,
  );

  const fieldErrors: Partial<Record<Field, string>> = {};
  if (!organizationName.trim()) fieldErrors.organizationName = "Indiquez le nom de l'organisation.";
  if (!organizationSlug.trim()) fieldErrors.organizationSlug = "Indiquez un identifiant.";
  else if (!SLUG_PATTERN.test(organizationSlug)) fieldErrors.organizationSlug = "Lettres minuscules, chiffres et tirets uniquement.";
  if (!adminEmail.trim()) fieldErrors.adminEmail = "Indiquez l'e-mail de l'administrateur.";
  else if (!EMAIL_SHAPE.test(adminEmail.trim())) fieldErrors.adminEmail = "Cette adresse e-mail semble incomplète.";
  const shown = (field: Field) => (submitted ? fieldErrors[field] : undefined);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.keys(fieldErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      const created = await authedFetch((token) =>
        createOrganization(
          {
            organizationName: organizationName.trim(),
            organizationSlug,
            adminEmail: adminEmail.trim(),
            adminFirstName: adminFirstName.trim() || undefined,
            adminLastName: adminLastName.trim() || undefined,
          },
          token,
        ),
      );
      onSaved(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Modal title="Nouvelle organisation" onClose={requestClose} closeDisabled={isSubmitting} widthClassName="max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <fieldset className="space-y-4" disabled={isSubmitting}>
            <legend className="mb-3 text-sm font-semibold text-ink">Organisation</legend>
            <Input
              label="Nom de l'organisation"
              value={organizationName}
              onChange={(e) => {
                setOrganizationName(e.target.value);
                if (!slugEdited) setOrganizationSlug(slugify(e.target.value));
              }}
              error={shown("organizationName")}
              autoFocus
              required
            />
            <div className="space-y-1.5">
              <Input
                label="Identifiant de l'espace de travail"
                placeholder="mon-organisation"
                value={organizationSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setOrganizationSlug(e.target.value.toLowerCase());
                }}
                error={shown("organizationSlug")}
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono"
                required
              />
              {shown("organizationSlug") ? null : (
                <p className="text-xs text-ink-muted">Unique et définitif. Proposé à partir du nom, modifiable avant la création.</p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-border pt-5" disabled={isSubmitting}>
            <legend className="sr-only">Premier administrateur</legend>
            <p aria-hidden className="text-sm font-semibold text-ink">
              Premier administrateur
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Prénom (admin)" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} autoComplete="off" />
              <Input label="Nom (admin)" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} autoComplete="off" />
            </div>
            <Input
              label="E-mail administrateur"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              error={shown("adminEmail")}
              autoComplete="off"
              required
            />
            <p className="text-sm text-ink-muted">
              Un e-mail d&apos;invitation sera envoyé à cette adresse : l&apos;administrateur y définira lui-même son mot de
              passe (lien valable 24 heures).
            </p>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-md border border-status-danger/35 bg-status-danger/10 px-3 py-2 text-sm text-ink">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Création…" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>
      {confirmElement}
    </>
  );
}
