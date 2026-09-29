"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { changePassword, updateMe } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * §5.11 — écran "Mon compte", accessible à tout utilisateur connecté (aucune
 * permission requise, voir modules/auth/routes.ts : `PATCH /auth/me` et
 * `POST /auth/change-password` sont gatés `authMiddleware` seul). Distinct de
 * `admin/organization` (paramètres de l'organisation, réservé aux admins).
 * Rôle, organisation et statut du compte restent en lecture seule — ce ne sont
 * jamais des droits qu'on s'attribue à soi-même.
 */
export default function AccountPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.11</p>
        <h1 className="font-display text-2xl font-bold text-ink">Mon compte</h1>
      </header>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-flat">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-muted">Organisation</dt>
          <dd className="text-ink">{user?.organization.name}</dd>
          <dt className="text-ink-muted">Rôle</dt>
          <dd className="text-ink">{user?.roleName}</dd>
        </dl>
      </div>

      <InfoSection />
      <PasswordSection />
    </div>
  );
}

function InfoSection() {
  const { user, authedFetch, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const { user: updated } = await authedFetch((token) =>
        updateMe({ firstName: firstName || undefined, lastName: lastName || undefined, email }, token),
      );
      updateUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
      <h2 className="font-display text-lg font-semibold text-ink">Informations</h2>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
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
  );
}

function PasswordSection() {
  const { authedFetch } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setIsSaving(true);
    try {
      await authedFetch((token) => changePassword({ currentPassword, newPassword }, token));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
      <h2 className="font-display text-lg font-semibold text-ink">Mot de passe</h2>
      <p className="text-xs text-ink-muted">
        Vos autres sessions actives (autres appareils/navigateurs) seront déconnectées — celle-ci reste active.
      </p>

      <Input
        label="Mot de passe actuel"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <Input
        label="Nouveau mot de passe"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Input
        label="Confirmer le nouveau mot de passe"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}
      {success ? <p className="text-sm text-status-success">Mot de passe modifié.</p> : null}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
        >
          {isSaving ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
      </div>
    </div>
  );
}
