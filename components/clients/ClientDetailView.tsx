"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientDetailDTO } from "@/lib/api/clients";
import { getClient, updateClient } from "@/lib/api/clients";
import { ApiError } from "@/lib/api/client";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";
import { getConfigurableList } from "@/lib/api/configurableLists";
import { useAuth } from "@/lib/auth/AuthContext";

const LIST_KEYS = [
  "CLIENT_DOSSIER_STATUS",
  "CLIENT_CIVILITE",
  "CLIENT_MARITAL_STATUS",
  "CLIENT_CHILDREN",
  "CLIENT_TYPE_RDV",
  "CLIENT_FINAL_STATUS",
] as const;

interface Lists {
  CLIENT_DOSSIER_STATUS: ConfigurableListItemDTO[];
  CLIENT_CIVILITE: ConfigurableListItemDTO[];
  CLIENT_MARITAL_STATUS: ConfigurableListItemDTO[];
  CLIENT_CHILDREN: ConfigurableListItemDTO[];
  CLIENT_TYPE_RDV: ConfigurableListItemDTO[];
  CLIENT_FINAL_STATUS: ConfigurableListItemDTO[];
}

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined) {
  if (!p) return "—";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
}

export function ClientDetailView({ clientId }: { clientId: string }) {
  const { user, authedFetch } = useAuth();
  const [client, setClient] = useState<ClientDetailDTO | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dossierStatusKey, setDossierStatusKey] = useState("");
  const [civiliteKey, setCiviliteKey] = useState("");
  const [maritalStatusKey, setMaritalStatusKey] = useState("");
  const [childrenKey, setChildrenKey] = useState("");
  const [typeRdvKey, setTypeRdvKey] = useState("");
  const [adresse, setAdresse] = useState("");
  const [comment, setComment] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSuccess, setInfoSuccess] = useState(false);

  const [finalStatusKey, setFinalStatusKey] = useState("");
  const [finalStatusSaving, setFinalStatusSaving] = useState(false);
  const [finalStatusError, setFinalStatusError] = useState<string | null>(null);
  const [finalStatusSuccess, setFinalStatusSuccess] = useState(false);

  function loadClientIntoForm(c: ClientDetailDTO) {
    setClient(c);
    setDossierStatusKey(c.dossierStatus.key);
    setCiviliteKey(c.civilite?.key ?? "");
    setMaritalStatusKey(c.maritalStatus?.key ?? "");
    setChildrenKey(c.children?.key ?? "");
    setTypeRdvKey(c.typeRdv?.key ?? "");
    setAdresse(c.adresse ?? "");
    setComment(c.comment ?? "");
    setFinalStatusKey(c.finalStatus.key);
  }

  useEffect(() => {
    authedFetch((token) => getClient(clientId, token))
      .then(loadClientIntoForm)
      .catch(() => setError("Impossible de charger ce dossier."));

    Promise.all(LIST_KEYS.map((key) => authedFetch((token) => getConfigurableList(key, token))))
      .then((results) => {
        const map = Object.fromEntries(LIST_KEYS.map((key, i) => [key, results[i]])) as unknown as Lists;
        setLists(map);
      })
      .catch(() => setError("Impossible de charger les listes configurables."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, clientId]);

  /**
   * §P0.4 — reflet côté UI de la même règle que le backend (canEditFinalStatus dans
   * modules/clients/service.ts) : Admin (clients.viewAll) ou agent RDV assigné. Ce
   * calcul ne fait que masquer/afficher le contrôle par confort — la garantie réelle
   * est entièrement recalculée et appliquée côté backend à chaque requête, quel que
   * soit ce que le front affiche ou cache.
   */
  const canEditFinalStatusUI = Boolean(
    user &&
      client &&
      user.permissions.includes("clients.editFinalStatus") &&
      (user.permissions.includes("clients.viewAll") || user.id === client.agentId),
  );

  async function handleSaveInfo() {
    setInfoError(null);
    setInfoSuccess(false);
    setInfoSaving(true);
    try {
      const updated = await authedFetch((token) =>
        updateClient(
          clientId,
          {
            dossierStatusKey,
            civiliteKey: civiliteKey || undefined,
            maritalStatusKey: maritalStatusKey || undefined,
            childrenKey: childrenKey || undefined,
            typeRdvKey: typeRdvKey || undefined,
            adresse: adresse || undefined,
            comment: comment || undefined,
          },
          token,
        ),
      );
      loadClientIntoForm(updated);
      setInfoSuccess(true);
    } catch (err) {
      setInfoError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setInfoSaving(false);
    }
  }

  async function handleSaveFinalStatus() {
    setFinalStatusError(null);
    setFinalStatusSuccess(false);
    setFinalStatusSaving(true);
    try {
      const updated = await authedFetch((token) => updateClient(clientId, { finalStatusKey }, token));
      loadClientIntoForm(updated);
      setFinalStatusSuccess(true);
    } catch (err) {
      setFinalStatusError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setFinalStatusSaving(false);
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-danger">{error}</p>
      </div>
    );
  }

  if (!client || !lists) {
    return (
      <div className="p-8">
        <p className="text-sm text-ink-muted">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="space-y-1">
        <Link href="/clients" className="text-sm text-ink-muted hover:text-ink">
          ← Mes dossiers
        </Link>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.8</p>
        <h1 className="font-display text-2xl font-bold text-ink">
          {client.firstName || client.lastName ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() : "Dossier"}
        </h1>
        <p className="font-mono text-sm text-forest-600">{client.phoneNumber}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-flat">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Télephoniste (créateur, non modifiable)</dt>
          <dd className="text-ink">{personLabel(client.telephoniste)}</dd>
          <dt className="text-ink-muted">Agent RDV assigné</dt>
          <dd className="text-ink">{personLabel(client.agent)}</dd>
          <dt className="text-ink-muted">Créé le</dt>
          <dd className="text-ink">{new Date(client.createdAt).toLocaleDateString("fr-FR")}</dd>
          <dt className="text-ink-muted">Pays</dt>
          <dd className="text-ink">{client.country.label}</dd>
        </dl>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <h2 className="font-display text-lg font-semibold text-ink">Dossier</h2>

        <Select label="Statut du dossier" value={dossierStatusKey} onChange={(e) => setDossierStatusKey(e.target.value)}>
          {lists.CLIENT_DOSSIER_STATUS.map((s) => (
            <option key={s.id} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Civilité" value={civiliteKey} onChange={(e) => setCiviliteKey(e.target.value)}>
            <option value="">—</option>
            {lists.CLIENT_CIVILITE.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select label="Situation familiale" value={maritalStatusKey} onChange={(e) => setMaritalStatusKey(e.target.value)}>
            <option value="">—</option>
            {lists.CLIENT_MARITAL_STATUS.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Enfants" value={childrenKey} onChange={(e) => setChildrenKey(e.target.value)}>
            <option value="">—</option>
            {lists.CLIENT_CHILDREN.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select label="Type de RDV" value={typeRdvKey} onChange={(e) => setTypeRdvKey(e.target.value)}>
            <option value="">—</option>
            {lists.CLIENT_TYPE_RDV.map((s) => (
              <option key={s.id} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <Input label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
        <Input label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />

        {infoError ? <p className="text-sm text-status-danger">{infoError}</p> : null}
        {infoSuccess ? <p className="text-sm text-status-success">Dossier mis à jour.</p> : null}

        <div className="flex justify-end">
          <Button onClick={handleSaveInfo} disabled={infoSaving}>
            {infoSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <h2 className="font-display text-lg font-semibold text-ink">Statut commercial final</h2>
        <p className="text-xs text-ink-muted">
          §P0.4 — modifiable uniquement par un administrateur ou l&apos;agent RDV assigné à ce dossier.
        </p>

        <div className="flex items-center gap-3">
          <StatusBadge label={client.finalStatus.label} color={client.finalStatus.color} />
        </div>

        {canEditFinalStatusUI ? (
          <>
            <Select label="Nouveau statut final" value={finalStatusKey} onChange={(e) => setFinalStatusKey(e.target.value)}>
              {lists.CLIENT_FINAL_STATUS.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {finalStatusError ? <p className="text-sm text-status-danger">{finalStatusError}</p> : null}
            {finalStatusSuccess ? <p className="text-sm text-status-success">Statut final mis à jour.</p> : null}
            <div className="flex justify-end">
              <Button onClick={handleSaveFinalStatus} disabled={finalStatusSaving}>
                {finalStatusSaving ? "Enregistrement…" : "Enregistrer le statut final"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Vous n&apos;êtes pas autorisé à modifier ce statut sur ce dossier.
          </p>
        )}
      </div>

      {client.adminNote !== null ? (
        <div className="rounded-lg border border-border bg-surface p-5 shadow-flat">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Note interne (administrateur)</h2>
          <p className="text-sm text-ink">{client.adminNote}</p>
        </div>
      ) : null}
    </div>
  );
}
