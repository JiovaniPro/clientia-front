"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import type { OrganizationDTO } from "@/lib/api/organizations";
import { getCurrentOrganization, updateCurrentOrganization } from "@/lib/api/organizations";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Écran d'administration §5.24 — paramètres de l'organisation. Le plus simple des
 * quatre écrans de ce lot : `GET/PATCH /organizations/me`, deux champs modifiables
 * (nom, couleur) plus le logo (URL texte — aucune infrastructure d'upload de
 * fichier n'existe côté backend, seulement un champ `logoUrl` en base). Le
 * `slug` (identifiant d'espace de travail) n'est volontairement pas éditable ici :
 * identifiant stable utilisé pour résoudre l'organisation à la connexion.
 */
export default function AdminOrganizationPage() {
  const { authedFetch } = useAuth();

  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2f6f4f");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const org = await authedFetch((token) => getCurrentOrganization(token));
      setOrganization(org);
      setName(org.name);
      setLogoUrl(org.logoUrl ?? "");
      setPrimaryColor(org.primaryColor ?? "#2f6f4f");
    } catch {
      setError("Impossible de charger les paramètres de l'organisation.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Le nom de l'organisation est obligatoire.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await authedFetch((token) =>
        updateCurrentOrganization(
          {
            name,
            // chaîne vide = "effacer le logo" (null), pas "ne rien changer" — voir
            // updateOrganizationSchema côté backend (logoUrl nullable().optional()).
            logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
            primaryColor,
          },
          token,
        ),
      );
      setOrganization(updated);
      setNotice("Paramètres enregistrés.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Administration</p>
        <h1 className="font-display text-2xl font-bold text-ink">Organisation</h1>
      </header>

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

      {isLoading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
          {organization ? (
            <p className="text-xs text-ink-faint">
              Espace de travail : <span className="font-mono">{organization.slug}</span> (non modifiable)
            </p>
          ) : null}

          <Input label="Nom de l'organisation" value={name} onChange={(e) => setName(e.target.value)} required />

          <Input
            label="URL du logo (optionnel)"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
          <p className="-mt-2 text-xs text-ink-muted">
            Lien vers une image déjà hébergée — il n&apos;y a pas d&apos;envoi de fichier depuis cet écran.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Couleur principale</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 rounded-md border border-border bg-surface"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
