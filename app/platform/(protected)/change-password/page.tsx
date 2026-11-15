"use client";

import { Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { PlatformNotice, PlatformPage, PlatformPageHeader } from "@/components/platform/PlatformPage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { changePlatformPassword } from "@/lib/api/platformAuth";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";
import { cn } from "@/lib/cn";

const MIN_LENGTH = 8;

/** Règle vérifiée en direct : coche quand elle est remplie (icône + texte, jamais la couleur seule). */
function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={cn("flex items-center gap-2 text-sm", ok ? "text-forest-600" : "text-ink-muted")}>
      {ok ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Circle size={10} strokeWidth={2} aria-hidden className="mx-0.5" />}
      {children}
      <span className="sr-only">{ok ? " — respecté" : " — non respecté"}</span>
    </li>
  );
}

/**
 * Forcé pour tout compte avec `mustChangePassword: true` (voir le layout protégé
 * parent) — mais aussi accessible librement à tout Super Admin qui veut changer
 * son mot de passe volontairement, pas seulement au premier login.
 */
export default function PlatformChangePasswordPage() {
  const { platformAdmin, authedFetch, setPlatformAdmin } = usePlatformAuth();
  const router = useRouter();
  const forced = Boolean(platformAdmin?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const longEnough = newPassword.length >= MIN_LENGTH;
  const differs = newPassword.length > 0 && newPassword !== currentPassword;
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!longEnough) {
      setError(`${MIN_LENGTH} caractères minimum.`);
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
      setDone(true);
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
    <PlatformPage narrow>
      <PlatformPageHeader
        crumbs={forced ? undefined : [{ href: "/platform/account", label: "Mon compte" }]}
        title={forced ? "Choisissez votre mot de passe" : "Changer le mot de passe"}
        description={
          forced
            ? "Votre mot de passe a été défini par la personne qui a créé ce compte. Choisissez-en un nouveau pour accéder à la console."
            : "Vos autres sessions actives seront déconnectées ; celle-ci reste active."
        }
      />

      {done ? <PlatformNotice tone="success">Mot de passe mis à jour. Ouverture de la console…</PlatformNotice> : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
        <Input
          label={forced ? "Mot de passe reçu" : "Mot de passe actuel"}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        <div className="space-y-2">
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="password-rules"
            required
          />
          <ul id="password-rules" className="space-y-1">
            <Rule ok={longEnough}>{`Au moins ${MIN_LENGTH} caractères`}</Rule>
            <Rule ok={differs}>Différent du mot de passe actuel</Rule>
          </ul>
        </div>
        <Input
          label="Confirmer le nouveau mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          error={confirmMismatch ? "Les deux mots de passe ne correspondent pas." : undefined}
          required
        />

        {error ? (
          <p role="alert" className="text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className={cn("flex border-t border-border pt-4", forced ? "justify-end" : "justify-between")}>
          {forced ? null : (
            <Button type="button" variant="secondary" onClick={() => router.push("/platform/account")} disabled={isSubmitting}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || done} aria-busy={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>
        </div>
      </form>
    </PlatformPage>
  );
}
