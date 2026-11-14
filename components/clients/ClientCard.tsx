import { ArrowRight, CalendarClock, CalendarOff, Mail } from "lucide-react";
import Link from "next/link";
import { ClientAvatar } from "@/components/clients/ClientAvatar";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ClientListItemDTO } from "@/lib/api/clients";
import { cn } from "@/lib/cn";
import { describeNextAppointment, type NextAppointmentTone } from "@/lib/clients/nextAppointment";

export function clientDisplayName(c: Pick<ClientListItemDTO, "firstName" | "lastName">) {
  return c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : "Sans nom";
}

const APPOINTMENT_TONE: Record<NextAppointmentTone, { box: string; icon: string }> = {
  today: { box: "bg-terracotta-500/10", icon: "bg-terracotta-500/15 text-terracotta-600" },
  soon: { box: "bg-forest-50", icon: "bg-forest-600/10 text-forest-600" },
  later: { box: "bg-surface-subtle", icon: "bg-border/60 text-ink-muted" },
  none: { box: "border border-dashed border-border", icon: "text-ink-faint" },
};

/** Bloc « prochain rendez-vous » : mis en avant quand il est proche, discret quand il n'y en a pas. */
export function NextAppointment({ iso, now }: { iso: string | null; now: Date }) {
  const next = describeNextAppointment(iso, now);
  const tone = APPOINTMENT_TONE[next.tone];
  const Icon = next.tone === "none" ? CalendarOff : CalendarClock;
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-3 py-2.5", tone.box)}>
      <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone.icon)}>
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-medium text-ink-muted">Prochain RDV</p>
        <p className={cn("truncate text-sm", next.tone === "none" ? "text-ink-muted" : "font-semibold text-ink")}>
          {next.label}
          {next.time ? <span className="ml-1.5 font-mono text-xs font-medium text-ink-muted">{next.time}</span> : null}
        </p>
      </div>
    </div>
  );
}

/** Prochain RDV en une ligne (vue liste) : « Demain 14:30 », teinté quand il est proche. */
export function NextAppointmentInline({ iso, now }: { iso: string | null; now: Date }) {
  const next = describeNextAppointment(iso, now);
  if (next.tone === "none") return <span className="text-ink-faint">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm",
        next.tone === "today" && "bg-terracotta-500/10 font-semibold text-ink",
        next.tone === "soon" && "bg-forest-50 font-medium text-ink",
        next.tone === "later" && "text-ink-muted",
      )}
    >
      <CalendarClock size={14} aria-hidden className={next.tone === "today" ? "text-terracotta-600" : "text-ink-muted"} />
      {next.label}
      <span className="font-mono text-xs text-ink-muted">{next.time}</span>
    </span>
  );
}

/**
 * Carte d'un dossier de l'agent RDV. Toute la carte ouvre le dossier (lien étiré sur le nom, un seul arrêt
 * clavier) ; les actions du bas (copier le numéro, e-mail) restent au-dessus et gardent leur propre effet.
 */
export function ClientCard({
  client,
  now,
  onSendEmail,
}: {
  client: ClientListItemDTO;
  now: Date;
  onSendEmail: (client: ClientListItemDTO) => void;
}) {
  const name = clientDisplayName(client);
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-flat transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-forest-600 hover:shadow-raised focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/30">
      <div className="flex items-start gap-3">
        <ClientAvatar id={client.id} firstName={client.firstName} lastName={client.lastName} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink">
            <Link
              href={`/clients/${client.id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {name}
            </Link>
          </h3>
          <p className="truncate text-xs text-ink-muted">{client.email ?? "Pas d'adresse e-mail"}</p>
        </div>
        <ArrowRight
          size={16}
          aria-hidden
          className="mt-1 shrink-0 text-ink-faint transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-forest-600"
        />
      </div>

      <div className="relative z-10 mt-4">
        <PhoneLink number={client.phoneNumber} className="text-sm" />
      </div>

      <div className="mt-4">
        <NextAppointment iso={client.nextAppointmentAt} now={now} />
      </div>

      <dl className="my-5 grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <dt className="text-ink-muted">Dossier</dt>
          <dd className="mt-1 truncate">
            <StatusBadge label={client.dossierStatus.label} color={client.dossierStatus.color} className="text-xs" />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-muted">Statut final</dt>
          <dd className="mt-1 truncate">
            <StatusBadge label={client.finalStatus.label} color={client.finalStatus.color} className="text-xs" />
          </dd>
        </div>
      </dl>

      <div className="relative z-10 mt-auto flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => onSendEmail(client)}
          disabled={!client.email}
          title={client.email ? `Écrire à ${client.email}` : "Ce client n'a pas d'adresse e-mail"}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-forest-600 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
        >
          <Mail size={14} aria-hidden />
          Envoyer un e-mail
        </button>
        <span aria-hidden className="text-xs font-medium text-ink-muted transition-colors group-hover:text-forest-600">
          Ouvrir le dossier
        </span>
      </div>
    </article>
  );
}

/** Même silhouette que ClientCard, pour le premier chargement. */
export function ClientCardSkeleton() {
  const block = "animate-pulse rounded-sm bg-surface-subtle";
  return (
    <div aria-hidden className="flex flex-col rounded-lg border border-border bg-surface p-5 shadow-flat">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-surface-subtle" />
        <div className="flex-1 space-y-2 pt-1">
          <div className={`h-4 w-2/3 ${block}`} />
          <div className={`h-3 w-1/2 ${block}`} />
        </div>
      </div>
      <div className={`mt-5 h-4 w-1/2 ${block}`} />
      <div className={`mt-4 h-14 w-full ${block}`} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`h-8 ${block}`} />
        <div className={`h-8 ${block}`} />
      </div>
      <div className={`mt-6 h-8 w-1/2 ${block}`} />
    </div>
  );
}
