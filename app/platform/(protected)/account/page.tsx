"use client";

import { ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { PlatformNotice, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
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
  const isDirty = name !== (platformAdmin?.name ?? "") || email !== (platformAdmin?.email ?? "");

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!platformAdmin) return;
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const updated = await authedFetch((token) =>
        updatePlatformProfile(platformAdmin.id, { name: name.trim() || undefined, email: email.trim() }, token),
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
    <PlatformPage narrow>
      <PlatformPageHeader title="Mon compte" description="Vos informations de connexion à la console plateforme." />

      {success ? (
        <PlatformNotice tone="success" onDismiss={() => setSuccess(false)}>
          Informations mises à jour.
        </PlatformNotice>
      ) : null}

      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <h2 className="text-base font-semibold text-ink">Informations</h2>
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Input
          label="E-mail (identifiant de connexion)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {error ? (
          <p role="alert" className="text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" disabled={isSaving || !isDirty} aria-busy={isSaving}>
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>

      <Link
        href="/platform/change-password"
        className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-5 shadow-flat transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
      >
        <KeyRound size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-ink">Mot de passe</span>
          <span className="block text-sm text-ink-muted">Changer le mot de passe : vos autres sessions seront déconnectées, celle-ci reste active.</span>
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
      </Link>
    </PlatformPage>
  );
}
