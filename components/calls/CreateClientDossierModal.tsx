"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { CallDTO } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type { ClientDetailDTO } from "@/lib/api/clients";
import { createClientDossier } from "@/lib/api/clients";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

interface CreateClientDossierModalProps {
  call: CallDTO;
  onClose: () => void;
  /** Le dossier créé — l'appelant s'en sert pour rejouer le statut ET pour le pont §P1.1 vers le calendrier. */
  onCreated: (client: ClientDetailDTO) => void;
}

/**
 * Étape de la cascade §P0.2 — ouverte quand le backend refuse un statut avec
 * `CLIENT_DOSSIER_REQUIRED`. Gap corrigé avant le lot 5 : `agentId` était fixé en
 * dur à l'utilisateur courant (le télephoniste qui qualifie l'appel), sans aucun
 * moyen de créer un dossier où le télephoniste diffère de l'agent RDV assigné —
 * pourtant le backend le permettait déjà. Le sélecteur liste les utilisateurs du
 * rôle "Agent RDV" (nom du rôle système par défaut, voir lib/defaultRoles.ts côté
 * backend) via le nouvel endpoint GET /users?role=&isActive=.
 */
export function CreateClientDossierModal({ call, onClose, onCreated }: CreateClientDossierModalProps) {
  const { authedFetch } = useAuth();
  const [countries, setCountries] = useState<ConfigurableListItemDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [firstName, setFirstName] = useState(call.firstName ?? "");
  const [lastName, setLastName] = useState(call.lastName ?? "");
  const [countryKey, setCountryKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    authedFetch((token) => getConfigurableList("CLIENT_COUNTRY", token))
      .then((items) => {
        setCountries(items);
        const defaultItem = items.find((i) => i.isDefault);
        if (defaultItem) setCountryKey(defaultItem.key);
      })
      .catch(() => setError("Impossible de charger la liste des pays."));

    authedFetch((token) => listUsers({ role: "Agent RDV", isActive: true }, token))
      .then((items) => {
        setAgents(items);
        if (items.length === 1) setAgentId(items[0]!.id);
      })
      .catch(() => setError("Impossible de charger la liste des agents RDV."));
  }, [authedFetch]);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const client = await authedFetch((token) =>
        createClientDossier(
          {
            callId: call.id,
            agentId,
            phoneNumber: call.toNumber,
            countryKey,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          },
          token,
        ),
      );
      onCreated(client);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Créer le dossier client" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Ce statut nécessite un dossier client. Créez-le, puis le statut sera enregistré automatiquement.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Téléphone" value={call.toNumber} disabled />
        <Select label="Pays" value={countryKey} onChange={(e) => setCountryKey(e.target.value)}>
          {countries.map((c) => (
            <option key={c.id} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select label="Agent RDV" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Sélectionner…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || a.email}
            </option>
          ))}
        </Select>
        {agents.length === 0 ? (
          <p className="text-xs text-ink-muted">Aucun agent RDV actif dans cette organisation.</p>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !countryKey || !agentId}>
            {isSubmitting ? "Création…" : "Créer et continuer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
