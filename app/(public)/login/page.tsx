"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [organizationSlug, setOrganizationSlug] = useState(searchParams.get("org") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ organizationSlug, email, password });
      router.push("/");
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
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
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

        <p className="text-center text-sm text-ink-muted">
          Pas encore d&apos;espace de travail ?{" "}
          <Link href="/register-organization" className="font-medium text-forest-600 hover:underline">
            Créer une organisation
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
