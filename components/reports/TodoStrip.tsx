"use client";

import type { LucideIcon } from "lucide-react";
import { AlarmClock, ArrowRight, PhoneOutgoing } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listCalls } from "@/lib/api/calls";
import { getConfigurableList } from "@/lib/api/configurableLists";
import { listReminders } from "@/lib/api/reminders";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

interface Todo {
  /** Appels encore au statut neutre dans SA file. null = pas la permission ou échec de chargement. */
  queue: number | null;
  /** Rappels en attente dont l'échéance est passée / tombe plus tard aujourd'hui. */
  overdue: number | null;
  today: number | null;
}

/**
 * "À traiter" — ce qui attend l'utilisateur MAINTENANT, au-dessus des statistiques (qui regardent le passé).
 * Toujours scopé à soi (userId explicite : avec calls.viewAll / reminders.viewAll, les listes renverraient
 * sinon toute l'organisation). Chaque chiffre mène à l'écran où on le traite. Purement informatif : un échec
 * de chargement masque la tuile concernée, jamais le tableau de bord.
 */
export function TodoStrip() {
  const { user, authedFetch, hasPermission } = useAuth();
  const canSeeCalls = hasPermission("calls.view");
  const canSeeReminders = hasPermission("reminders.view");
  const userId = user?.id;
  const [todo, setTodo] = useState<Todo | null>(null);

  useEffect(() => {
    if (!userId || (!canSeeCalls && !canSeeReminders)) return;
    let cancelled = false;

    const queue = canSeeCalls
      ? authedFetch((token) => getConfigurableList("CALL_STATUS", token))
          .then((statuses) => {
            const neutralKey = statuses.find((s) => s.isDefault)?.key;
            if (!neutralKey) return null;
            return authedFetch((token) => listCalls({ statusKey: neutralKey, userId, page: 1, pageSize: 1 }, token)).then(
              (res) => res.total,
            );
          })
          .catch(() => null)
      : Promise.resolve(null);

    const reminders = canSeeReminders
      ? authedFetch((token) => listReminders({ status: "PENDING", userId }, token))
          .then((items) => {
            const now = Date.now();
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            // Avec reminders.viewAll, la liste peut contenir les rappels liés d'autres agents : on ne garde que les siens.
            const mine = items.filter((r) => r.userId === userId).map((r) => new Date(r.dueAt).getTime());
            return {
              overdue: mine.filter((t) => t < now).length,
              today: mine.filter((t) => t >= now && t <= endOfToday.getTime()).length,
            };
          })
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([queue, reminders]).then(([queueCount, reminderCounts]) => {
      if (cancelled) return;
      setTodo({ queue: queueCount, overdue: reminderCounts?.overdue ?? null, today: reminderCounts?.today ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, userId, canSeeCalls, canSeeReminders]);

  if (!todo || (todo.queue === null && todo.overdue === null)) return null;

  return (
    <section aria-label="À traiter" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {todo.queue !== null ? (
        <TodoLink
          href="/calls"
          icon={PhoneOutgoing}
          count={todo.queue}
          label={todo.queue > 1 ? "appels à passer" : "appel à passer"}
          action="Ouvrir la file"
        />
      ) : null}
      {todo.overdue !== null ? (
        <TodoLink
          href="/reminders"
          icon={AlarmClock}
          count={todo.overdue}
          label={todo.overdue > 1 ? "rappels en retard" : "rappel en retard"}
          action="Voir les rappels"
          urgent={todo.overdue > 0}
        />
      ) : null}
      {todo.today !== null ? (
        <TodoLink
          href="/reminders"
          icon={AlarmClock}
          count={todo.today}
          label={todo.today > 1 ? "rappels prévus aujourd'hui" : "rappel prévu aujourd'hui"}
          action="Voir les rappels"
        />
      ) : null}
    </section>
  );
}

/** Tuile « à traiter » (chiffre + libellé + lien) : partagée avec le tableau de bord Agent RDV. */
export function TodoLink({
  href,
  icon: Icon,
  count,
  label,
  action,
  urgent = false,
}: {
  href: string;
  icon: LucideIcon;
  count: number;
  label: string;
  action: string;
  /** Retard : teinte d'alerte + libellé explicite ("en retard"), jamais la couleur seule. */
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-surface px-4 py-3 shadow-flat transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        urgent ? "border-status-warning/50 hover:border-status-warning" : "border-border hover:border-forest-600",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          urgent ? "bg-status-warning/10 text-status-warning" : "bg-forest-50 text-forest-600",
        )}
      >
        <Icon size={18} />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink-muted">
        <span className="mr-1.5 font-display text-xl font-bold tabular-nums text-ink">{count}</span>
        {label}
      </p>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-forest-600">
        <span className="hidden sm:inline">{action}</span>
        <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
