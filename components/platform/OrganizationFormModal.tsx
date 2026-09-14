"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import type { PlatformOrganizationDetailDTO } from "@/lib/api/platformOrganizations";
import { createOrganization } from "@/lib/api/platformOrganizations";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

interface OrganizationFormModalProps {
  onClose: () => void;
  onSaved: (organization: PlatformOrganizationDetailDTO) => void;
}

/**
 * Création uniquement — même provisioning que l'auto-inscription publique (voir
 * organizations/service.ts::createOrganization), juste déclenchée par un Super
 * Admin plutôt qu'un visiteur. Pas d'édition ici : §5.24 (déjà livré) couvre déjà
 * la modification du nom/logo/couleur, depuis l'écran organisation de l'organisation
 * elle-même — pas de deuxième porte d'entrée qui le dupliquerait.
 */
export function OrganizationFormModal({ onClose, onSaved }: OrganizationFormModalProps) {
  const { authedFetch } = usePlatformAuth();

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!organizationName.trim() || !organizationSlug.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      setError("Tous les champs marqués requis doivent être remplis.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await authedFetch((token) =>
        createOrganization(
          {
            organizationName,
            organizationSlug,
            adminEmail,
            adminPassword,
            adminFirstName: adminFirstName || undefined,
            adminLastName: adminLastName || undefined,
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
    <Modal title="Nouvelle organisation" onClose={onClose}>
      <div className="space-y-4">
        <Input
          label="Nom de l'organisation"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
        />
        <Input
          label="Identifiant de l'espace de travail"
          placeholder="mon-organisation"
          value={organizationSlug}
          onChange={(e) => setOrganizationSlug(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom (admin)" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
          <Input label="Nom (admin)" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
        </div>
        <Input
          label="E-mail administrateur"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          required
        />
        <Input
          label="Mot de passe initial"
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          minLength={8}
          required
        />

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
