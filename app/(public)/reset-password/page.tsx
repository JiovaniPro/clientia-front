"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { confirmPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Sous-lot Utilisateurs (§2.2) — page publique ouverte depuis le lien envoyé par
 * e-mail (création de compte OU réinitialisation par un admin, même mécanisme).
 * Jamais d'espace de travail/email à saisir ici : le jeton dans l'URL identifie
 * déjà l'utilisateur sans ambiguïté côté backend.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Lien invalide : jeton manquant.");
      return;
    }
    if (newPassword.length < 8) {
      setError("8 caractères minimum.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(token, newPassword);
      setIsDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">CRM · call-tracking</p>
          <h1 className="font-display text-3xl font-bold text-ink">CLIENTIA</h1>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
          {isDone ? (
            <>
              <p className="text-sm text-ink">
                Mot de passe défini. Vous pouvez maintenant vous connecter.
              </p>
              <Link href="/login" className="block">
                <Button type="button" className="w-full">
                  Aller à la connexion
                </Button>
              </Link>
            </>
          ) : !token ? (
            <p className="text-sm text-status-danger">
              Lien invalide — le jeton de réinitialisation est manquant. Redemandez un lien.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                required
              />

              {error ? <p className="text-sm text-status-danger">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement…" : "Définir le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
