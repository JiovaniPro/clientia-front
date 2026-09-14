"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { EventPanel } from "@/components/calendar/EventPanel";
import type { CalendarDTO, CalendarEventDTO, EventCategoryDTO } from "@/lib/api/calendar";
import { createCalendar, getEvent, listCalendars, listEventCategories, listEvents, updateEvent } from "@/lib/api/calendar";
import { ApiError } from "@/lib/api/client";
import type { ClientDetailDTO } from "@/lib/api/clients";
import { getClient } from "@/lib/api/clients";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { addDays, formatDayLabel, formatWeekRangeLabel, startOfWeek } from "@/lib/calendar/dateUtils";
import { useAuth } from "@/lib/auth/AuthContext";

type ViewMode = "week" | "day";
type EventPrefill = { title: string; callId: string; agentRdvId?: string };
type PanelState =
  | { mode: "create"; start: Date; prefill?: EventPrefill }
  | { mode: "edit"; event: CalendarEventDTO }
  | null;

function personLabel(p: { firstName: string | null; lastName: string | null } | null | undefined, fallback = "—") {
  if (!p) return fallback;
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || fallback;
}

/**
 * §5.14 sous-lots A + B — grille + événements simples (A), puis glisser-déposer,
 * redimensionnement et répartition en colonnes façon Outlook (B, voir
 * components/calendar/CalendarGrid.tsx et lib/calendar/layout.ts). Plus le pont
 * §P0.4 "suite du flux" / §P1.1 : quand on arrive ici avec
 * `?pendingClientId=<id>` (posé par QualifyCallModal juste après la création
 * réussie d'un dossier), une bannière affiche le client en attente de
 * planification et un clic sur un créneau pré-remplit un rendez-vous avec son
 * appel et son agent déjà sélectionnés. Sous-lot C1 : catégories personnelles —
 * `categoriesById` colore le liseré des événements sur la grille (voir
 * CalendarGrid.tsx), la sélection/création se fait depuis EventPanel. Le reste du
 * sous-lot C (participants, rappels d'événement, conflits généraux, récurrence)
 * arrive dans des livrables séparés, tout comme le workflow accepter/refuser/
 * compteur de disponibilité (reste du sous-lot D). Les deux invariants absolus du
 * §P0.5 (un seul RDV actif par appel, pas de chevauchement pour un agent RDV)
 * sont vérifiés côté backend à CHAQUE écriture (création ET déplacement/
 * redimensionnement — modules/calendar/service.ts::updateEvent appelle
 * assertNoAgentOverlap comme createEvent) ; un glisser qui créerait un
 * chevauchement est rejeté en 409 et l'événement revient exactement à sa position
 * d'origine (voir handleEventDrop ci-dessous).
 */
function CalendarProContent() {
  const { user, authedFetch, hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingClientId = searchParams.get("pendingClientId");
  const eventIdParam = searchParams.get("eventId");
  const canCreate = hasPermission("calendar.create");
  const canUpdate = hasPermission("calendar.update");
  const canDelete = hasPermission("calendar.delete");
  const canViewAll = hasPermission("calendar.viewAll");

  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [myCalendar, setMyCalendar] = useState<CalendarDTO | null>(null);
  /** §5.13 — un calendrier à la fois, jamais superposés (décision explicite) :
   * "" = le mien ; sinon l'id d'un autre agent, résolu vers son calendrier via
   * `allCalendars` ci-dessous. */
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [allCalendars, setAllCalendars] = useState<CalendarDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>(null);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [pendingClient, setPendingClient] = useState<ClientDetailDTO | null>(null);
  const [pendingClientError, setPendingClientError] = useState<string | null>(null);
  const [categories, setCategories] = useState<EventCategoryDTO[]>([]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    if (!pendingClientId) {
      setPendingClient(null);
      return;
    }
    setPendingClientError(null);
    authedFetch((token) => getClient(pendingClientId, token))
      .then(setPendingClient)
      .catch(() => setPendingClientError("Impossible de charger le client en attente de planification."));
  }, [pendingClientId, authedFetch]);

  function dismissPendingClient() {
    setPendingClient(null);
    router.replace("/calendar-pro");
  }

  /**
   * §P1.3 point 2 — redirection contextuelle depuis une notification EVENT_INVITATION
   * (ou toute autre notification calendrier portant `meta.eventId`, voir
   * app/(app)/notifications/page.tsx) : ouvre directement le panneau d'édition de
   * l'événement visé et fait sauter la semaine affichée sur sa date.
   */
  useEffect(() => {
    if (!eventIdParam) return;
    authedFetch((token) => getEvent(eventIdParam, token))
      .then((event) => {
        setAnchorDate(new Date(event.startAt));
        setPanel({ mode: "edit", event });
      })
      .catch(() => setError("Impossible de charger l'événement lié à la notification."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdParam, authedFetch]);

  function clearEventDeepLink() {
    if (eventIdParam) router.replace("/calendar-pro");
  }

  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchorDate), i)) : [anchorDate];

  /**
   * Aucun calendrier personnel n'est auto-provisionné à la création d'un
   * utilisateur (gap distinct, hors périmètre de ce sous-lot) — cet écran
   * s'assure lui-même qu'un calendrier personnel existe au premier chargement.
   *
   * Bug réel observé en prod locale : `POST /calendars` échouait en 500
   * (contrainte unique `userId+name`) quand deux appels concurrents voyaient tous
   * les deux "aucun calendrier" puis tentaient de le créer en même temps — le
   * mount effect de React peut se déclencher deux fois (Strict Mode en dev), et
   * chaque déclenchement relançait tout le flux list→create indépendamment. Même
   * classe de course que le dédoublonnage de /auth/refresh dans AuthContext.tsx —
   * `inFlightRef` fait que tous les appelants concurrents partagent la MÊME
   * promesse au lieu de se marcher dessus. Gardé par `userId` : si l'utilisateur
   * change (déconnexion/reconnexion) pendant qu'une requête est en vol, elle ne
   * doit pas être réutilisée pour le nouvel utilisateur.
   */
  const ensureCalendarInFlight = useRef<{ userId: string; promise: Promise<CalendarDTO | null> } | null>(null);
  const ensureCalendar = useCallback(async (): Promise<CalendarDTO | null> => {
    if (!user?.id) return null;
    if (ensureCalendarInFlight.current?.userId === user.id) {
      return ensureCalendarInFlight.current.promise;
    }

    const promise = (async (): Promise<CalendarDTO | null> => {
      const existing = await authedFetch((token) => listCalendars(token));
      const mine = existing.find((c) => c.userId === user.id);
      if (mine) return mine;
      if (!canCreate) return null;
      try {
        return await authedFetch((token) => createCalendar({ name: "Mon calendrier", color: "#1f6f54" }, token));
      } catch {
        const retry = await authedFetch((token) => listCalendars(token));
        return retry.find((c) => c.userId === user.id) ?? null;
      }
    })();

    ensureCalendarInFlight.current = { userId: user.id, promise };
    promise.finally(() => {
      if (ensureCalendarInFlight.current?.promise === promise) ensureCalendarInFlight.current = null;
    });
    return promise;
  }, [authedFetch, user?.id, canCreate]);

  useEffect(() => {
    ensureCalendar()
      .then(setMyCalendar)
      .catch(() => setError("Impossible d'initialiser le calendrier."));
  }, [ensureCalendar]);

  useEffect(() => {
    // §5.13 — la liste des calendriers/agents (pour le sélecteur) n'a de sens
    // qu'avec calendar.viewAll ; sans elle, on ne montre jamais que le sien.
    if (!canViewAll) return;
    authedFetch((token) => listCalendars(token))
      .then(setAllCalendars)
      .catch(() => {});
    authedFetch((token) => listUsers({}, token))
      .then(setAgents)
      .catch(() => {});
  }, [canViewAll, authedFetch]);

  const isViewingOther = selectedAgentId !== "" && selectedAgentId !== user?.id;
  /**
   * Le calendrier d'un AUTRE agent, résolu seulement quand on le regarde
   * explicitement — jamais appliqué par défaut sur "soi-même" : sans ce filtre,
   * la portée par défaut d'un utilisateur normal (`eventAccessFilter` côté
   * backend) inclut déjà les événements où il est invité ou agent RDV assigné sur
   * un calendrier qui n'est PAS le sien. Forcer `calendarId: myCalendar.id` par
   * défaut ferait disparaître ces événements-là — régression évitée en ne
   * touchant JAMAIS au comportement par défaut, seulement au cas explicite "je
   * regarde le calendrier de quelqu'un d'autre".
   */
  const otherCalendar = isViewingOther ? (allCalendars.find((c) => c.userId === selectedAgentId) ?? null) : null;

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const from = days[0]!;
      const to = addDays(days[days.length - 1]!, 1);
      if (isViewingOther && !otherCalendar) {
        // L'agent choisi n'a jamais ouvert son propre calendrier (aucun
        // auto-provisionné à la création d'un compte) — rien à charger, pas une erreur.
        setEvents([]);
        return;
      }
      const items = await authedFetch((token) =>
        listEvents(
          {
            from: from.toISOString(),
            to: to.toISOString(),
            ...(otherCalendar ? { calendarId: otherCalendar.id } : {}),
          },
          token,
        ),
      );
      setEvents(items);
    } catch {
      setError("Impossible de charger les événements.");
    } finally {
      setIsLoading(false);
    }
    // days est recalculé à chaque rendu depuis anchorDate/view — on ne dépend que de ces deux-là.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, anchorDate, view, isViewingOther, otherCalendar]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchCategories = useCallback(() => {
    authedFetch((token) => listEventCategories(token))
      .then(setCategories)
      .catch(() => {
        // Non bloquant : sans catégories, la grille retombe simplement sur la couleur de type.
      });
  }, [authedFetch]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function goToday() {
    setAnchorDate(new Date());
  }
  function goPrev() {
    setAnchorDate((d) => addDays(d, view === "week" ? -7 : -1));
  }
  function goNext() {
    setAnchorDate((d) => addDays(d, view === "week" ? 7 : 1));
  }

  function handleSlotClick(start: Date) {
    // §5.13 — lecture seule sur le calendrier d'un autre agent : superviser n'est
    // pas créer un rendez-vous au nom de quelqu'un d'autre depuis cet écran.
    if (!canCreate || !myCalendar || isViewingOther) return;
    const prefill: EventPrefill | undefined = pendingClient
      ? {
          title: `RDV — ${personLabel(pendingClient, pendingClient.phoneNumber)}`,
          callId: pendingClient.callId,
          agentRdvId: pendingClient.agentId,
        }
      : undefined;
    setPanel({ mode: "create", start, prefill });
  }
  function handleEventClick(event: CalendarEventDTO) {
    setPanel({ mode: "edit", event });
  }
  function closePanel() {
    setPanel(null);
    clearEventDeepLink();
    // Point 3 des retours de test : répondre à sa propre invitation (Accepter/
    // Décliner) se fait dans le panneau sans passer par handleSaved (ce n'est pas
    // un enregistrement de l'événement) — sans ce refetch, le badge "invitation en
    // attente" de la grille resterait périmé après une fermeture par "Fermer".
    fetchEvents();
  }
  function handleSaved() {
    setPanel(null);
    // §P1.1 : le RDV vient d'être créé depuis le panneau pré-rempli — le client n'est plus en attente.
    if (pendingClient) dismissPendingClient();
    clearEventDeepLink();
    fetchEvents();
    fetchCategories(); // une catégorie a pu être créée/supprimée depuis le panneau (sous-lot C1).
  }
  function handleDeleted() {
    setPanel(null);
    clearEventDeepLink();
    fetchEvents();
  }

  /**
   * Sous-lot B — glisser-déposer / redimensionnement : point d'attention explicite
   * de l'utilisateur, "pas juste une mise à jour visuelle optimiste sans
   * confirmation serveur". La grille (CalendarGrid) affiche déjà un aperçu en
   * direct pendant le geste ; ICI, au relâchement, on applique la même position en
   * optimiste dans l'état source (pour éviter un flash de retour à l'ancienne
   * position pendant l'attente réseau), puis on appelle le vrai PATCH. Le backend
   * revérifie les invariants §P0.5 dans `updateEvent` (modules/calendar/
   * service.ts::assertNoAgentOverlap) — un déplacement qui crée un chevauchement
   * est rejeté en 409. En cas d'échec (conflit ou autre), l'état repasse
   * EXACTEMENT à sa valeur pré-geste — jamais laissé dans un état qui ne
   * correspond pas à la base.
   */
  async function handleEventDrop(event: CalendarEventDTO, newStart: Date, newEnd: Date) {
    const previousEvents = events;
    setDropError(null);
    setEvents((prev) =>
      prev.map((e) => (e.id === event.id ? { ...e, startAt: newStart.toISOString(), endAt: newEnd.toISOString() } : e)),
    );
    setPendingEventId(event.id);
    try {
      const updated = await authedFetch((token) =>
        updateEvent(event.id, { startAt: newStart.toISOString(), endAt: newEnd.toISOString() }, token),
      );
      setEvents((prev) => prev.map((e) => (e.id === event.id ? updated : e)));
    } catch (err) {
      setEvents(previousEvents);
      setDropError(err instanceof ApiError ? err.message : "Impossible de déplacer cet événement.");
    } finally {
      setPendingEventId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">§5.14 — sous-lots A + B</p>
          <h1 className="font-display text-2xl font-bold text-ink">
            {isViewingOther
              ? (() => {
                  const agent = agents.find((a) => a.id === selectedAgentId);
                  return `Calendrier — ${personLabel(agent, agent?.email ?? "—")}`;
                })()
              : "Calendrier"}
          </h1>
          {canViewAll && agents.length > 0 ? (
            <Select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="mt-1.5 w-56"
            >
              <option value="">Moi-même</option>
              {agents
                .filter((a) => a.id !== user?.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {personLabel(a, a.email)}
                    {!a.isActive ? " (inactif)" : ""}
                  </option>
                ))}
            </Select>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={goToday}>
            Aujourd'hui
          </Button>
          <Button size="sm" variant="ghost" onClick={goPrev} aria-label="Précédent">
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" variant="ghost" onClick={goNext} aria-label="Suivant">
            <ChevronRight size={16} />
          </Button>
          <span className="min-w-[220px] text-sm font-medium text-ink">
            {view === "week" ? formatWeekRangeLabel(startOfWeek(anchorDate)) : formatDayLabel(anchorDate)}
          </span>
          <div className="flex rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-l-md px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-forest-600 text-white" : "text-ink-muted hover:bg-surface-subtle"}`}
            >
              Semaine
            </button>
            <button
              type="button"
              onClick={() => setView("day")}
              className={`rounded-r-md px-3 py-1.5 text-sm font-medium ${view === "day" ? "bg-forest-600 text-white" : "text-ink-muted hover:bg-surface-subtle"}`}
            >
              Jour
            </button>
          </div>
        </div>
      </header>

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}
      {pendingClientError ? <p className="text-sm text-status-danger">{pendingClientError}</p> : null}
      {pendingClient ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-terracotta-500/30 bg-terracotta-500/10 p-3">
          <div className="text-sm text-ink">
            <p className="font-medium">
              Client en attente de planification : {personLabel(pendingClient)}
            </p>
            <p className="text-ink-muted">
              {pendingClient.phoneNumber}
              {pendingClient.email ? ` · ${pendingClient.email}` : ""} · Agent RDV : {personLabel(pendingClient.agent)}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Cliquez sur un créneau pour créer son rendez-vous — l'appel et l'agent seront déjà sélectionnés.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissPendingClient}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-subtle hover:text-ink"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {dropError ? (
        <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
          {dropError} — l'événement est revenu à sa position d'origine.
        </p>
      ) : null}
      {!myCalendar && !error && !isViewingOther ? (
        <p className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-ink-muted">
          Aucun calendrier personnel et vous n'avez pas la permission d'en créer un — vous pouvez voir les événements
          partagés mais pas en créer de nouveaux.
        </p>
      ) : null}
      {isViewingOther && !otherCalendar && !isLoading ? (
        <p className="rounded-md border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-ink-muted">
          Cet agent n'a pas encore de calendrier personnel (aucun événement à afficher).
        </p>
      ) : null}
      {isViewingOther && otherCalendar ? (
        <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-ink-muted">
          Lecture seule : la création d'événement depuis cet écran reste réservée à votre propre calendrier.
        </p>
      ) : null}
      {isLoading ? <p className="text-sm text-ink-muted">Chargement…</p> : null}

      <CalendarGrid
        days={days}
        events={events}
        onSlotClick={handleSlotClick}
        onEventClick={handleEventClick}
        canDrag={canUpdate && !isViewingOther}
        onEventDrop={handleEventDrop}
        pendingEventId={pendingEventId}
        categoriesById={categoriesById}
      />

      {panel ? (
        <EventPanel
          event={panel.mode === "edit" ? panel.event : undefined}
          initialStart={panel.mode === "create" ? panel.start : undefined}
          prefill={panel.mode === "create" ? panel.prefill : undefined}
          calendarId={myCalendar?.id ?? ""}
          canDelete={canDelete}
          onClose={closePanel}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}

export default function CalendarProPage() {
  return (
    <Suspense fallback={null}>
      <CalendarProContent />
    </Suspense>
  );
}
