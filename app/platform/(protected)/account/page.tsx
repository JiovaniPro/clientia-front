"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { updatePlatformProfile } from "@/lib/api/platformAuth";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

/**
 * "Mon compte" de la console Super Admin — miroir de app/(app)/account/page.tsx.
 * Le changement de mot de passe reste sur /platform/change-password (écran déjà
 * imposé par le layout quand `mustChangePassword` est vrai) : simple lien ici.
 */
export default function PlatformAccountPage() {
  const { platformAdmin, authedFetch, setPlatformAdmin } = usePlatformAuth();

  const [name, setName] = useState(platformAdmin?.name ?? "");
  const [email, setEmail] = useState(platformAdmin?.email ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { markClean } = useUnsavedChangesGuard({ name, email });

  async function handleSave() {
    if (!platformAdmin) return;
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const updated = await authedFetch((token) =>
        updatePlatformProfile(platformAdmin.id, { name: name || undefined, email }, token),
      );
      setPlatformAdmin({ ...platformAdmin, email: updated.email, name: updated.name });
      markClean();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Console Super Admin</p>
        <h1 className="font-display text-2xl font-bold text-ink">Mon compte</h1>
      </header>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <h2 className="font-display text-lg font-semibold text-ink">Informations</h2>
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="E-mail (identifiant de connexion)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}
        {success ? <p className="text-sm text-status-success">Informations mises à jour.</p> : null}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Mot de passe</h2>
          <p className="text-xs text-ink-muted">Vos autres sessions actives seront déconnectées — celle-ci reste active.</p>
        </div>
        <Link
          href="/platform/change-password"
          className="shrink-0 text-sm font-medium text-forest-600 underline-offset-2 hover:underline"
        >
          Changer le mot de passe
        </Link>
      </div>
    </div>
  );
}
