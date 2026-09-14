"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { changePlatformPassword } from "@/lib/api/platformAuth";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Forcé pour tout compte avec `mustChangePassword: true` (voir le layout protégé
 * parent) — mais aussi accessible librement à tout Super Admin qui veut changer
 * son mot de passe volontairement, pas seulement au premier login.
 */
export default function PlatformChangePasswordPage() {
  const { platformAdmin, authedFetch, setPlatformAdmin, logout } = usePlatformAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 8) {
      setError("8 caractères minimum.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setIsSubmitting(true);
    try {
      await authedFetch((token) => changePlatformPassword({ currentPassword, newPassword }, token));
      if (platformAdmin) setPlatformAdmin({ ...platformAdmin, mustChangePassword: false });
      setNotice("Mot de passe mis à jour. Redirection…");
      // Le backend révoque les autres sessions à ce changement (voir
      // modules/platform/auth/service.ts::changeOwnPassword) — celle-ci reste
      // valide jusqu'à expiration de l'access token en cours, mais on redirige
      // quand même vers l'écran d'accueil plutôt que de laisser croire qu'il faut
      // se reconnecter immédiatement.
      setTimeout(() => router.replace("/platform"), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Console Super Admin</p>
        <h1 className="font-display text-2xl font-bold text-ink">Changer le mot de passe</h1>
      </header>

      {platformAdmin?.mustChangePassword ? (
        <p className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm text-ink">
          Votre mot de passe a été défini par la personne qui a créé ce compte — choisissez-en un nouveau avant de
          continuer.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
        <Input
          label="Mot de passe actuel"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {notice ? <p className="text-sm text-forest-600">{notice}</p> : null}
        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-between pt-2">
          {!platformAdmin?.mustChangePassword ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => logout().then(() => router.replace("/platform/login"))}
            >
              Annuler
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>
        </div>
      </form>
    </div>
  );
}
