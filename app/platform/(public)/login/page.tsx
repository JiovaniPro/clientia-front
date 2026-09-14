"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Coquille visuellement distincte de l'écran de connexion organisation (§5.29,
 * point 5) : accent terracotta plutôt que forest, mention explicite "Console
 * Super Admin" — pas juste un détail cosmétique, un rappel constant qu'on n'est
 * pas dans le même espace de confiance qu'une organisation cliente.
 */
export default function PlatformLoginPage() {
  const { login } = usePlatformAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/platform");
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
          <p className="font-mono text-xs uppercase tracking-wide text-terracotta-500">Console Super Admin</p>
          <h1 className="font-display text-3xl font-bold text-ink">CLIENTIA</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error ? <p className="text-sm text-status-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <p className="text-center text-xs text-ink-faint">
          Réservé aux comptes Super Admin — les utilisateurs d&apos;organisation se connectent sur l&apos;écran habituel.
        </p>
      </div>
    </div>
  );
}
