import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const SAMPLE_CALLS = [
  { name: "Camille Rochat", phone: "+41 79 214 18 32", status: "RDV fixé", color: "#2f7d5a" },
  { name: "Thibault Meunier", phone: "+41 78 602 44 19", status: "À rappeler", color: "#b98900" },
  { name: "Sophie Girardin", phone: "+33 6 71 05 38 24", status: "Ne répond pas", color: "#3b6e91" },
  { name: "Laurent Baumann", phone: "+41 76 330 92 07", status: "Refus", color: "#b3432f" },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-12 p-10">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Système de design — Lot 1</p>
          <h1 className="font-display text-4xl font-bold text-ink">Chaque appel trouve sa place.</h1>
          <p className="text-ink-muted">Tokens Tailwind v4 + composants de base, à valider avant propagation.</p>
        </div>
        <ThemeToggle />
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Boutons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Accéder à la plateforme</Button>
          <Button variant="secondary">Voir la démo</Button>
          <Button variant="ghost">Annuler</Button>
          <Button variant="danger">Supprimer</Button>
          <Button variant="primary" size="sm">
            Petit
          </Button>
          <Button variant="primary" disabled>
            Désactivé
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Champ de saisie</h2>
        <div className="max-w-sm">
          <Input label="Numéro de téléphone" placeholder="+41 79 000 00 00" />
        </div>
        <div className="max-w-sm">
          <Input label="E-mail" defaultValue="pas-un-email" error="E-mail invalide" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Badges de statut</h2>
        <div className="flex flex-wrap items-center gap-4">
          <StatusBadge label="RDV fixé" color="#2f7d5a" />
          <StatusBadge label="À rappeler" color="#b98900" />
          <StatusBadge label="Ne répond pas" color="#3b6e91" />
          <StatusBadge label="Refus" color="#b3432f" />
          <StatusBadge label="Sans couleur définie" />
          <StatusBadge label="V-2411" color="#1f6f54" variant="outline" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Carte — file d&apos;appels (aperçu)</h2>
        <div className="max-w-md rounded-lg border border-border bg-surface p-4 shadow-flat">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-semibold text-ink">File d&apos;attente · 42 prospects</span>
            <StatusBadge label="V-2411" color="#1f6f54" variant="outline" />
          </div>
          <ul className="space-y-2.5">
            {SAMPLE_CALLS.map((call) => (
              <li key={call.phone} className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{call.name}</span>
                <span className="font-mono text-forest-600">{call.phone}</span>
                <StatusBadge label={call.status} color={call.color} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
