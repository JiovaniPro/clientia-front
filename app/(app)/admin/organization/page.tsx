"use client";

import { Check, Copy, ImageOff, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminFeedback } from "@/components/admin/kit/Feedback";
import { AdminHeader } from "@/components/admin/kit/Controls";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadError } from "@/components/ui/ListStates";
import { ApiError } from "@/lib/api/client";
import type { OrganizationDTO } from "@/lib/api/organizations";
import { getCurrentOrganization, updateCurrentOrganization } from "@/lib/api/organizations";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";
import { useUnsavedChangesGuard } from "@/lib/forms/useUnsavedChangesGuard";

const DEFAULT_COLOR = "#2f6f4f";
const HEX = /^#[0-9a-f]{6}$/i;
/** Teintes proposées d'un clic : celles de la marque, puis des tons sobres (jamais de violet ni de dégradé). */
const PRESETS = [
  { value: "#1f6f54", name: "Vert forêt" },
  { value: "#2f6f4f", name: "Vert mousse" },
  { value: "#3b6e91", name: "Bleu acier" },
  { value: "#c9622b", name: "Terracotta" },
  { value: "#b98900", name: "Ocre" },
  { value: "#b3432f", name: "Brique" },
  { value: "#14171c", name: "Encre" },
];

/** Texte lisible (blanc ou encre) sur une couleur de fond donnée, d'après sa luminance perçue. */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  return luminance > 0.4 ? "#14171c" : "#ffffff";
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Logo de l'organisation, ou ses initiales sur la couleur de marque si l'image manque ou ne charge pas. */
function LogoTile({ url, name, color, size }: { url: string; name: string; color: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- URL libre saisie par l'administrateur : pas de domaine à déclarer pour next/image
    return <img src={url} alt="" onError={() => setFailed(true)} style={box} className="shrink-0 rounded-md bg-white object-contain" />;
  }
  return (
    <span
      aria-hidden
      style={{ ...box, backgroundColor: color, color: readableOn(color), fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-md font-semibold"
    >
      {url && failed ? <ImageOff size={size * 0.45} /> : initialsOf(name)}
    </span>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // presse-papiers indisponible : l'identifiant reste sélectionnable
        }
      }}
      aria-label={copied ? "Identifiant copié" : "Copier l'identifiant de l'espace de travail"}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-1 font-mono text-xs text-ink transition-colors hover:border-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
    >
      {value}
      {copied ? <Check size={13} aria-hidden className="text-status-success" /> : <Copy size={13} aria-hidden className="text-ink-muted" />}
    </button>
  );
}

/**
 * Écran d'administration §5.24 — paramètres de l'organisation. `GET/PATCH /organizations/me` : nom, couleur,
 * logo (URL texte — aucune infrastructure d'upload de fichier n'existe côté backend, seulement un champ
 * `logoUrl` en base). Le `slug` (identifiant d'espace de travail) n'est volontairement pas éditable :
 * identifiant stable utilisé pour résoudre l'organisation à la connexion.
 *
 * Présentation : le formulaire à gauche, à droite un aperçu en direct (dans l'application et dans les e-mails
 * envoyés aux clients, où le nom, le logo et la couleur apparaissent réellement), et une barre d'enregistrement
 * qui n'apparaît que lorsqu'il y a des modifications.
 */
export default function AdminOrganizationPage() {
  const { authedFetch } = useAuth();

  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // §6.25 lot E — beforeunload seulement. Référence prise une fois l'organisation
  // chargée : avant, la couleur vaut le défaut "#2f6f4f", pas celle de l'organisation.
  const { markClean } = useUnsavedChangesGuard({ name, logoUrl, primaryColor }, undefined, organization !== null);

  const fetchOrganization = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const org = await authedFetch((token) => getCurrentOrganization(token));
      setOrganization(org);
      setName(org.name);
      setLogoUrl(org.logoUrl ?? "");
      setPrimaryColor(org.primaryColor ?? DEFAULT_COLOR);
    } catch {
      setLoadFailed(true);
      setError("Impossible de charger les paramètres de l'organisation.");
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const colorValid = HEX.test(primaryColor);
  const dirty =
    organization !== null &&
    (name !== organization.name ||
      logoUrl.trim() !== (organization.logoUrl ?? "") ||
      primaryColor.toLowerCase() !== (organization.primaryColor ?? DEFAULT_COLOR).toLowerCase());

  function reset() {
    if (!organization) return;
    setName(organization.name);
    setLogoUrl(organization.logoUrl ?? "");
    setPrimaryColor(organization.primaryColor ?? DEFAULT_COLOR);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Le nom de l'organisation est obligatoire.");
      return;
    }
    if (!colorValid) {
      setError("La couleur doit être au format #RRGGBB.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await authedFetch((token) =>
        updateCurrentOrganization(
          {
            name,
            // chaîne vide = "effacer le logo" (null), pas "ne rien changer" — voir
            // updateOrganizationSchema côté backend (logoUrl nullable().optional()).
            logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
            primaryColor,
          },
          token,
        ),
      );
      setOrganization(updated);
      setLogoUrl(updated.logoUrl ?? "");
      markClean();
      setNotice("Paramètres enregistrés.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewColor = colorValid ? primaryColor : DEFAULT_COLOR;
  const previewName = name.trim() || "Votre organisation";
  const card = "space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat";

  return (
    <div className="space-y-6 p-6 pb-28">
      <AdminHeader
        parent="Administration"
        title="Organisation"
        description="Le nom, le logo et la couleur de votre organisation. Ils apparaissent dans l'application et dans les e-mails envoyés à vos clients."
      />

      {loadFailed ? (
        <div className="rounded-lg border border-border bg-surface shadow-flat">
          <LoadError message="Impossible de charger les paramètres de l'organisation." onRetry={fetchOrganization} />
        </div>
      ) : isLoading ? (
        <div role="status" aria-label="Chargement…" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-lg bg-surface-subtle" />
            <div className="h-56 animate-pulse rounded-lg bg-surface-subtle" />
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-surface-subtle" />
          <span className="sr-only">Chargement…</span>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            <section aria-labelledby="org-identity" className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="org-identity" className="font-display text-base font-semibold text-ink">
                  Identité
                </h2>
                {organization ? (
                  <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
                    <Lock size={12} aria-hidden /> Espace de travail (non modifiable) <CopyChip value={organization.slug} />
                  </span>
                ) : null}
              </div>
              <Input label="Nom de l'organisation" value={name} onChange={(e) => setName(e.target.value)} required />
            </section>

            <section aria-labelledby="org-logo" className={card}>
              <h2 id="org-logo" className="font-display text-base font-semibold text-ink">
                Logo
              </h2>
              <div className="flex flex-wrap items-start gap-4">
                {/* key : l'état « image introuvable » repart à zéro dès que l'adresse change. */}
                <LogoTile key={logoUrl} url={logoUrl.trim()} name={previewName} color={previewColor} size={64} />
                <div className="min-w-0 flex-1 basis-64 space-y-1.5">
                  <Input
                    label="Adresse du logo (optionnel)"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    inputMode="url"
                  />
                  <p className="text-xs text-ink-muted">
                    Lien vers une image déjà hébergée (PNG ou SVG, fond transparent de préférence). Sans logo, vos initiales sont
                    affichées sur votre couleur.
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="org-color" className={card}>
              <h2 id="org-color" className="font-display text-base font-semibold text-ink">
                Couleur principale
              </h2>
              <div role="group" aria-label="Couleurs proposées" className="flex flex-wrap gap-2.5">
                {PRESETS.map((p) => {
                  const on = primaryColor.toLowerCase() === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${p.name} ${p.value}`}
                      title={p.name}
                      onClick={() => setPrimaryColor(p.value)}
                      style={{ backgroundColor: p.value, color: readableOn(p.value) }}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                        on && "ring-2 ring-ink",
                      )}
                    >
                      {on ? <Check size={16} strokeWidth={2.5} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="org-color-picker" className="text-sm font-medium text-ink">
                    Autre couleur
                  </label>
                  <input
                    id="org-color-picker"
                    type="color"
                    value={colorValid ? primaryColor : DEFAULT_COLOR}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface p-1"
                  />
                </div>
                <div className="w-36">
                  <Input
                    label="Code couleur"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
                    maxLength={7}
                    spellCheck={false}
                    error={colorValid ? undefined : "Format #RRGGBB"}
                    className="font-mono"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Aperçu en direct, collé en haut pendant le défilement. */}
          <aside aria-label="Aperçu" className="space-y-4 lg:sticky lg:top-6">
            <div className={card}>
              <h2 className="font-display text-base font-semibold text-ink">Dans l&apos;application</h2>
              <div className="rounded-md border border-border bg-cream p-4">
                <div className="flex items-center gap-3">
                  <LogoTile key={`app-${logoUrl}`} url={logoUrl.trim()} name={previewName} color={previewColor} size={36} />
                  <p className="truncate font-semibold text-ink">{previewName}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
                    style={{ backgroundColor: previewColor, color: readableOn(previewColor) }}
                  >
                    Se connecter
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: previewColor }} />
                    Statut actif
                  </span>
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="font-display text-base font-semibold text-ink">Dans vos e-mails</h2>
              <div className="rounded-md border border-border bg-surface-subtle p-3">
                <div className="rounded-md border border-border bg-white p-4 text-[#14171c]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#14171c]">CLIENTIA</span>
                    <span className="truncate text-[11px] font-semibold text-[#5b5f66]">{previewName}</span>
                  </div>
                  <div className="mt-3 h-1 w-10 rounded-sm" style={{ backgroundColor: previewColor }} />
                  <p className="mt-3 text-sm font-semibold">Votre rendez-vous est confirmé</p>
                  <div className="mt-2 space-y-1.5" aria-hidden>
                    <div className="h-1.5 w-full rounded-sm bg-[#e4e1d9]" />
                    <div className="h-1.5 w-2/3 rounded-sm bg-[#e4e1d9]" />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Barre d'enregistrement : n'apparaît que s'il y a quelque chose à enregistrer. */}
      {dirty ? (
        <div
          role="region"
          aria-label="Modifications non enregistrées"
          className="app-rise fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-6 py-3 shadow-raised backdrop-blur-sm lg:left-60"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden className="h-2 w-2 rounded-full bg-status-warning" />
              Modifications non enregistrées
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={reset} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !colorValid}>
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminFeedback notice={notice} error={loadFailed ? null : error} onDismissNotice={() => setNotice(null)} onDismissError={() => setError(null)} />
    </div>
  );
}
