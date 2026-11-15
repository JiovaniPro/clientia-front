"use client";

import { ArrowRight, Check, CircleAlert, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ApiError } from "@/lib/api/client";
import { usePlatformAuth } from "@/lib/auth/PlatformAuthContext";

/**
 * Connexion à la console Super Admin — distincte de l'écran des organisations (§5.29, point 5) par son
 * repère « Console plateforme » et son texte, pas par une autre identité : même famille visuelle que l'app.
 * Mêmes retours que /login : verrouillage majuscules, bouton à trois états, erreur annoncée (role="alert").
 */
export default function PlatformLoginPage() {
  const { login } = usePlatformAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login({ email: email.trim(), password });
      setStatus("success");
      router.push("/platform");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setStatus("idle");
    }
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <div className="app-type flex min-h-screen flex-col bg-cream px-5">
      <header className="flex h-16 items-center justify-end">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center pb-16 pt-[8vh]">
        <div className="w-full max-w-sm">
          <Logo className="h-8" priority />
          <p className="mt-6 flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden className="text-terracotta-500" />
            Console plateforme
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Connexion administrateur</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Création, suspension et suivi des organisations clientes.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-lg border border-border bg-surface p-5 shadow-flat">
            <Input
              label="E-mail"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            <div className="space-y-1.5">
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
                required
              />
              <p aria-live="polite" className="min-h-5 text-sm text-status-warning">
                {capsLock ? "Verrouillage des majuscules activé." : ""}
              </p>
            </div>

            {error ? (
              <p role="alert" className="app-rise flex items-start gap-2.5 rounded-md border border-status-danger/35 bg-status-danger/10 px-3 py-2.5 text-sm text-ink">
                <CircleAlert aria-hidden strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
                {error}
              </p>
            ) : null}

            <Button type="submit" className="group w-full" aria-busy={status === "submitting"}>
              {status === "submitting" ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
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
                  <ArrowRight aria-hidden strokeWidth={1.75} className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            Réservé aux comptes Super Admin. Vous utilisez CLIENTIA dans une organisation ?{" "}
            <Link
              href="/login"
              className="whitespace-nowrap rounded-sm font-medium text-forest-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
            >
              Connexion organisation
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
