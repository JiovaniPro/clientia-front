"use client";

import { ArrowLeft, ArrowRight, Building2, Check, CircleAlert, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { LoginShowcase } from "@/components/auth/LoginShowcase";
import { displayFont } from "@/components/brand/displayFont";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;
const FIELD = "h-12! text-base!";
const rise = (delay: number) => ({ "--delay": `${delay}ms` }) as React.CSSProperties;

/**
 * Connexion — deux colonnes sur grand écran (formulaire / panneau de marque LoginShowcase),
 * formulaire seul en dessous. Retours immédiats : e-mail vérifié à la sortie du champ,
 * avertissement verrouillage majuscules, bouton à trois états (repos, envoi, réussite),
 * erreur du serveur annoncée (role="alert") et affichée telle quelle.
 */
function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOrg = searchParams.get("org") ?? "";
  const initialEmail = searchParams.get("email") ?? "";

  const [organizationSlug, setOrganizationSlug] = useState(initialOrg);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const busy = status !== "idle";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setStatus("submitting");
    try {
      await login({ organizationSlug: organizationSlug.trim(), email: email.trim(), password });
      setStatus("success");
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setStatus("idle");
    }
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <div className={`${displayFont.variable} brand-type grid min-h-screen grid-cols-1 bg-cream lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}>
      <div className="flex min-h-screen flex-col px-5 sm:px-10">
        <header className="flex h-[4.5rem] items-center justify-between gap-4">
          <Link href="/" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
            <Logo className="h-9" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="group hidden items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 sm:inline-flex"
            >
              <ArrowLeft aria-hidden strokeWidth={1.5} className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Retour au site
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center py-6">
          <div className="mx-auto w-full max-w-[26rem]">
            <h1 className="landing-rise font-display text-3xl leading-[1.12] text-ink sm:text-[2.6rem]">Content de vous revoir.</h1>
            <p className="landing-rise mt-4 text-base leading-relaxed text-ink-muted" style={rise(70)}>
              Connectez-vous à l&apos;espace de travail de votre organisation.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div className="landing-rise" style={rise(140)}>
                <Input
                  label="Espace de travail"
                  icon={Building2}
                  placeholder="demo"
                  value={organizationSlug}
                  onChange={(e) => setOrganizationSlug(e.target.value)}
                  autoComplete="organization"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus={!initialOrg}
                  required
                  className={FIELD}
                />
              </div>
              <div className="landing-rise" style={rise(200)}>
                <Input
                  label="E-mail"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  onBlur={() => setEmailError(email && !EMAIL_SHAPE.test(email.trim()) ? "Cette adresse e-mail semble incomplète." : undefined)}
                  error={emailError}
                  autoComplete="email"
                  autoFocus={Boolean(initialOrg) && !initialEmail}
                  required
                  className={FIELD}
                />
              </div>
              <div className="landing-rise" style={rise(260)}>
                <Input
                  label="Mot de passe"
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  onBlur={() => setCapsLock(false)}
                  autoComplete="current-password"
                  autoFocus={Boolean(initialOrg) && Boolean(initialEmail)}
                  required
                  className={FIELD}
                />
                <div className="mt-2 flex items-start justify-between gap-4">
                  <p aria-live="polite" className="text-sm text-status-warning">
                    {capsLock ? "Verrouillage des majuscules activé." : ""}
                  </p>
                  <Link
                    href="/forgot-password"
                    className="shrink-0 rounded-sm text-sm font-medium text-forest-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>

              {error ? (
                <p role="alert" className="app-rise flex items-start gap-2.5 rounded-md border border-status-danger/40 bg-status-danger/10 px-3.5 py-3 text-sm text-ink">
                  <CircleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
                  {error}
                </p>
              ) : null}

              <div className="landing-rise pt-1" style={rise(320)}>
                <Button type="submit" aria-busy={status === "submitting"} className="group h-12! w-full text-base! dark:text-cream">
                  {status === "submitting" ? (
                    <>
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                      Connexion…
                    </>
                  ) : status === "success" ? (
                    <>
                      <Check aria-hidden strokeWidth={2.5} className="h-4 w-4" />
                      Connecté, ouverture…
                    </>
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight aria-hidden strokeWidth={1.5} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <p className="landing-rise mt-9 border-t border-border pt-6 text-sm leading-relaxed text-ink-muted" style={rise(380)}>
              L&apos;accès se fait sur invitation de votre administrateur. Pas encore d&apos;espace de travail ?{" "}
              <Link
                href="/#contact"
                className="whitespace-nowrap rounded-sm font-semibold text-ink underline decoration-forest-600 decoration-2 underline-offset-4 transition-colors duration-150 hover:text-forest-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              >
                Demander une démonstration
              </Link>
            </p>
          </div>
        </main>

        <footer className="py-4 text-xs text-ink-muted">© {new Date().getFullYear()} CLIENTIA</footer>
      </div>

      <LoginShowcase />
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
