"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, apiClient } from "@/lib/api/client";

interface CreateOrganizationResponse {
  organization: { id: string; name: string; slug: string };
  adminUser: { id: string; email: string };
}

export default function RegisterOrganizationPage() {
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post<CreateOrganizationResponse>("/organizations", {
        organizationName,
        organizationSlug,
        adminEmail,
        adminPassword,
        adminFirstName: adminFirstName || undefined,
        adminLastName: adminLastName || undefined,
      });
      router.push(`/login?org=${encodeURIComponent(organizationSlug)}&email=${encodeURIComponent(adminEmail)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
        const firstFieldError = fieldErrors && Object.values(fieldErrors).flat()[0];
        setError(firstFieldError ?? err.message);
      } else {
        setError("Une erreur est survenue.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">CRM · call-tracking</p>
          <h1 className="font-display text-3xl font-bold text-ink">Créer une organisation</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-flat">
          <Input
            label="Nom de l'organisation"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
          <Input
            label="Identifiant de l'espace de travail"
            placeholder="mon-organisation"
            value={organizationSlug}
            onChange={(e) => setOrganizationSlug(e.target.value)}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lettres minuscules, chiffres et tirets uniquement"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
            <Input label="Nom" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
          </div>
          <Input
            label="E-mail administrateur"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error ? <p className="text-sm text-status-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer l'organisation"}
          </Button>
        </form>
      </div>
    </div>
  );
}
