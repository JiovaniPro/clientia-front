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
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

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
 *
 * Type de RDV : choisi ICI avec le client, pendant l'appel — c'est lui qui pilote
 * la suite dans le calendrier (case Google Meet pré-cochée via le drapeau
 * `requiresVideoLink`). Choix obligatoire, sans pré-sélection : un défaut silencieux
 * ferait partir un RDV « à domicile » qu'on n'a pas demandé au client. Les champs
 * conditionnels suivent les drapeaux du type, jamais une clé en dur : adresse si
 * `requiresAddress`, e-mail si `requiresVideoLink` (sans e-mail, pas de lien envoyé).
 */
export function CreateClientDossierModal({ call, onClose, onCreated }: CreateClientDossierModalProps) {
  const { authedFetch } = useAuth();
  const [countries, setCountries] = useState<ConfigurableListItemDTO[]>([]);
  const [typesRdv, setTypesRdv] = useState<ConfigurableListItemDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [firstName, setFirstName] = useState(call.firstName ?? "");
  const [lastName, setLastName] = useState(call.lastName ?? "");
  const [email, setEmail] = useState(call.email ?? "");
  const [countryKey, setCountryKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [typeRdvKey, setTypeRdvKey] = useState("");
  const [adresse, setAdresse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingLoads, setPendingLoads] = useState(3);
  // §6.25 — pays par défaut et agent unique sont pré-sélectionnés après chargement :
  // référence prise une fois les deux listes chargées, sinon ce pré-remplissage
  // serait vu comme une saisie. `.finally` passe après `.then`, donc après les défauts.
  const { requestClose, confirmElement } = useUnsavedChangesGuard(
    { firstName, lastName, email, countryKey, agentId, typeRdvKey, adresse },
    onClose,
    pendingLoads <= 0,
  );

  useEffect(() => {
    authedFetch((token) => getConfigurableList("CLIENT_COUNTRY", token))
      .then((items) => {
        setCountries(items);
        const defaultItem = items.find((i) => i.isDefault);
        if (defaultItem) setCountryKey(defaultItem.key);
      })
      .catch(() => setError("Impossible de charger la liste des pays."))
      .finally(() => setPendingLoads((n) => n - 1));

    authedFetch((token) => getConfigurableList("CLIENT_TYPE_RDV", token))
      .then((items) => setTypesRdv(items.filter((i) => i.isActive)))
      .catch(() => setError("Impossible de charger les types de rendez-vous."))
      .finally(() => setPendingLoads((n) => n - 1));

    authedFetch((token) => listUsers({ role: "Agent RDV", isActive: true }, token))
      .then((items) => {
        setAgents(items);
        if (items.length === 1) setAgentId(items[0]!.id);
      })
      .catch(() => setError("Impossible de charger la liste des agents RDV."))
      .finally(() => setPendingLoads((n) => n - 1));
  }, [authedFetch]);

  const typeRdv = typesRdv.find((t) => t.key === typeRdvKey);
  const needsAddress = Boolean(typeRdv?.metadata?.requiresAddress);
  const needsVideoLink = Boolean(typeRdv?.metadata?.requiresVideoLink);
  const missingAddress = needsAddress && !adresse.trim();
  const missingEmail = needsVideoLink && !email.trim();

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
            email: email.trim() || undefined,
            typeRdvKey,
            ...(needsAddress ? { adresse: adresse.trim() } : {}),
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
    <>
    <Modal title="Créer le dossier client" onClose={requestClose} closeDisabled={isSubmitting}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Ce statut nécessite un dossier client. Créez-le, puis le statut sera enregistré automatiquement.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Téléphone" value={call.toNumber} disabled />
        <Select label="Type de RDV" value={typeRdvKey} onChange={(e) => setTypeRdvKey(e.target.value)}>
          <option value="">Choisir avec le client…</option>
          {typesRdv.map((t) => (
            <option key={t.id} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        {needsAddress ? (
          <Input
            label="Adresse du rendez-vous"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            error={missingAddress ? "Adresse obligatoire pour ce type de RDV." : undefined}
          />
        ) : null}
        <Input
          label={needsVideoLink ? "E-mail (requis pour envoyer le lien de la visio)" : "E-mail"}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={missingEmail ? "Le lien Google Meet est envoyé par e-mail : renseignez-le." : undefined}
        />
        {needsVideoLink ? (
          <p className="text-xs text-ink-muted">
            Un lien Google Meet sera créé à la prise du RDV et envoyé au client et à l&apos;agent RDV.
          </p>
        ) : null}
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
          <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !countryKey || !agentId || !typeRdvKey || missingAddress || missingEmail}
          >
            {isSubmitting ? "Création…" : "Créer et continuer"}
          </Button>
        </div>
      </div>
    </Modal>
    {confirmElement}
    </>
  );
}
