"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordResetLink } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "@/lib/auth/messages";

/**
 * Même couple (espace de travail, e-mail) que le login : un e-mail n'est unique que par organisation. Les
 * seuls échecs distingués sont ceux qui ne dépendent JAMAIS de l'existence du compte (limiteur 429,
 * réseau) : le message d'un ApiError est affiché tel quel, comme sur le login.
 */
export default function ForgotPasswordPage() {
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordResetLink({ organizationSlug, email });
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
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
          <p className="text-sm text-ink-muted">Mot de passe oublié</p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
          {isDone ? (
            <p role="status" className="text-sm text-ink">
              {FORGOT_PASSWORD_SUCCESS_MESSAGE}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Espace de travail"
                placeholder="demo"
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                autoComplete="organization"
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              {error ? <p className="text-sm text-status-danger">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-forest-600 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
