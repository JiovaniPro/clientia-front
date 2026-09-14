"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { addDays, formatDayHeader, isSameDay } from "@/lib/calendar/dateUtils";
import { layoutDayEvents } from "@/lib/calendar/layout";
import type { CalendarEventDTO, EventCategoryDTO, EventType } from "@/lib/api/calendar";

/**
 * Fenêtre horaire fixe — pas de défilement pleine journée ni de zoom (hors
 * périmètre). 1 heure = HOUR_HEIGHT px, donc 1 minute = HOUR_HEIGHT/60 px : la
 * conversion date -> position pixel est exacte, pas arrondie à la demi-heure.
 */
export const RANGE_START_HOUR = 7;
export const RANGE_END_HOUR = 21;
const HOUR_HEIGHT = 56;
const SNAP_MINUTES = 30;
const MIN_DURATION_MINUTES = 30;
const GRID_HEIGHT = (RANGE_END_HOUR - RANGE_START_HOUR) * HOUR_HEIGHT;
/** Distance de pointeur en dessous de laquelle un geste est traité comme un clic, pas un glisser. */
const DRAG_THRESHOLD_PX = 4;

const TYPE_COLOR: Record<EventType, string> = {
  APPOINTMENT: "var(--color-terracotta-500)",
  MEETING: "var(--color-status-info)",
  PERSONAL: "var(--color-status-neutral)",
  BLOCKED_TIME: "var(--color-ink-faint)",
  REMINDER_EVENT: "var(--color-status-warning)",
};

export const TYPE_LABEL: Record<EventType, string> = {
  APPOINTMENT: "Rendez-vous",
  MEETING: "Réunion",
  PERSONAL: "Personnel",
  BLOCKED_TIME: "Bloqué",
  REMINDER_EVENT: "Rappel",
};

/**
 * Sous-lot C4 — anneau de bordure pour la sévérité de conflit (décision actée),
 * distinct des 3 canaux déjà en place (fond = type, liseré gauche 3px = catégorie,
 * pastille de coin = invitation en attente). Composé manuellement dans le même
 * `boxShadow` inline que le liseré de catégorie (pas via les classes `ring-*` de
 * Tailwind, qui poseraient leur propre `box-shadow` et se feraient écraser par le
 * style inline existant) : une couche "espacement" à la couleur de fond de la
 * carte pour garantir un anneau visible même quand la sévérité partage la même
 * teinte que le type de l'événement (ex. MEETING est déjà bleu = --color-status-
 * info, la même couleur qu'un conflit INFO) — vérifié en capture avant livraison.
 */
const CONFLICT_SEVERITY_COLOR: Record<"INFO" | "WARNING" | "CRITICAL", string> = {
  INFO: "var(--color-status-info)",
  WARNING: "var(--color-status-warning)",
  CRITICAL: "var(--color-status-danger)",
};

const CONFLICT_SEVERITY_LABEL: Record<"INFO" | "WARNING" | "CRITICAL", string> = {
  INFO: "Conflit — information",
  WARNING: "Conflit — avertissement",
  CRITICAL: "Conflit — critique",
};

function minutesSinceRangeStart(date: Date): number {
  return (date.getHours() - RANGE_START_HOUR) * 60 + date.getMinutes();
}

function snapMinutes(rawMinutes: number): number {
  return Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function eventPixelStyle(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const top = Math.max(0, (minutesSinceRangeStart(start) / 60) * HOUR_HEIGHT);
  const rawBottom = (minutesSinceRangeStart(end) / 60) * HOUR_HEIGHT;
  const bottom = Math.min(GRID_HEIGHT, rawBottom);
  const height = Math.max(bottom - top, 20);
  return { top, height };
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  eventId: string;
  mode: DragMode;
  originStart: Date;
  originEnd: Date;
  originDayIndex: number;
  pointerStartX: number;
  pointerStartY: number;
  currentStart: Date;
  currentEnd: Date;
  moved: boolean;
}

interface CalendarGridProps {
  days: Date[];
  events: CalendarEventDTO[];
  onSlotClick: (start: Date) => void;
  onEventClick: (event: CalendarEventDTO) => void;
  /** `calendar.update` — sans ça, ni glisser-déposer ni redimensionnement ne s'activent. */
  canDrag: boolean;
  /**
   * Appelé une fois au relâchement (pas à chaque pixel de mouvement) avec les
   * nouvelles dates proposées. Le composant affiche déjà l'aperçu optimiste
   * pendant le geste ; c'est à l'appelant (CalendarProPage) de confirmer via un
   * vrai PATCH /calendar-events/:id et de fournir `revert` en cas d'échec —
   * jamais une mise à jour visuelle sans confirmation serveur (§P0.5 : un
   * déplacement peut créer un chevauchement qui n'existait pas avant).
   */
  onEventDrop: (event: CalendarEventDTO, newStart: Date, newEnd: Date) => void;
  /** Événement en cours d'enregistrement serveur — affiché en attente (opacité réduite), pas interactif. */
  pendingEventId?: string | null;
  /** Sous-lot C1 — indexées par id, pour afficher le liseré de couleur sans requête par événement. */
  categoriesById?: Record<string, EventCategoryDTO>;
}

export function CalendarGrid({
  days,
  events,
  onSlotClick,
  onEventClick,
  canDrag,
  onEventDrop,
  pendingEventId,
  categoriesById = {},
}: CalendarGridProps) {
  const hours = Array.from({ length: RANGE_END_HOUR - RANGE_START_HOUR }, (_, i) => RANGE_START_HOUR + i);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<DragState | null>(null);
  /** Un clic qui suit immédiatement un vrai glisser ne doit pas rouvrir le panneau d'édition. */
  const suppressNextClickRef = useRef(false);

  /** Événements affichés = les vrais, sauf celui en cours de glisser (remplacé par l'aperçu en direct). */
  const displayEvents = useMemo(() => {
    if (!drag) return events;
    return events.map((e) =>
      e.id === drag.eventId ? { ...e, startAt: drag.currentStart.toISOString(), endAt: drag.currentEnd.toISOString() } : e,
    );
  }, [events, drag]);

  function dayIndexAtX(clientX: number): number | null {
    for (let i = 0; i < dayRefs.current.length; i++) {
      const rect = dayRefs.current[i]?.getBoundingClientRect();
      if (rect && clientX >= rect.left && clientX < rect.right) return i;
    }
    return null;
  }

  function startDrag(event: CalendarEventDTO, mode: DragMode, e: React.PointerEvent) {
    if (!canDrag || pendingEventId) return;
    e.preventDefault();
    e.stopPropagation();
    const originStart = new Date(event.startAt);
    const originEnd = new Date(event.endAt);
    const originDayIndex = days.findIndex((d) => isSameDay(d, originStart));
    const state: DragState = {
      eventId: event.id,
      mode,
      originStart,
      originEnd,
      originDayIndex: originDayIndex === -1 ? 0 : originDayIndex,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      currentStart: originStart,
      currentEnd: originEnd,
      moved: false,
    };
    dragRef.current = state;
    setDrag(state);

    function onPointerMove(ev: PointerEvent) {
      const s = dragRef.current;
      if (!s) return;
      const deltaY = ev.clientY - s.pointerStartY;
      const deltaX = ev.clientX - s.pointerStartX;
      const moved = s.moved || Math.abs(deltaY) > DRAG_THRESHOLD_PX || Math.abs(deltaX) > DRAG_THRESHOLD_PX;
      const deltaMinutes = snapMinutes((deltaY / HOUR_HEIGHT) * 60);

      let nextStart = s.originStart;
      let nextEnd = s.originEnd;

      if (s.mode === "move") {
        const targetDayIndex = dayIndexAtX(ev.clientX) ?? s.originDayIndex;
        const dayDelta = targetDayIndex - s.originDayIndex;
        nextStart = addDays(new Date(s.originStart.getTime() + deltaMinutes * 60_000), dayDelta);
        nextEnd = addDays(new Date(s.originEnd.getTime() + deltaMinutes * 60_000), dayDelta);
      } else if (s.mode === "resize-start") {
        nextStart = new Date(s.originStart.getTime() + deltaMinutes * 60_000);
        if (nextStart.getTime() > s.originEnd.getTime() - MIN_DURATION_MINUTES * 60_000) {
          nextStart = new Date(s.originEnd.getTime() - MIN_DURATION_MINUTES * 60_000);
        }
        nextEnd = s.originEnd;
      } else {
        nextEnd = new Date(s.originEnd.getTime() + deltaMinutes * 60_000);
        if (nextEnd.getTime() < s.originStart.getTime() + MIN_DURATION_MINUTES * 60_000) {
          nextEnd = new Date(s.originStart.getTime() + MIN_DURATION_MINUTES * 60_000);
        }
        nextStart = s.originStart;
      }

      const updated: DragState = { ...s, currentStart: nextStart, currentEnd: nextEnd, moved };
      dragRef.current = updated;
      setDrag(updated);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const s = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (s?.moved && (s.currentStart.getTime() !== s.originStart.getTime() || s.currentEnd.getTime() !== s.originEnd.getTime())) {
        suppressNextClickRef.current = true;
        onEventDrop(event, s.currentStart, s.currentEnd);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-surface shadow-flat">
      <div className="w-14 shrink-0 border-r border-border">
        <div className="h-10 border-b border-border" />
        {hours.map((hour) => (
          <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative">
            <span className="absolute -top-2.5 right-2 font-mono text-xs text-ink-faint">
              {String(hour).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-x-auto">
        {days.map((day, index) => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            events={displayEvents}
            hours={hours}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            canDrag={canDrag}
            draggingEventId={drag?.eventId ?? null}
            pendingEventId={pendingEventId ?? null}
            categoriesById={categoriesById}
            onStartDrag={startDrag}
            consumeSuppressClick={() => {
              const suppress = suppressNextClickRef.current;
              suppressNextClickRef.current = false;
              return suppress;
            }}
            columnRef={(el) => {
              dayRefs.current[index] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  events,
  hours,
  onSlotClick,
  onEventClick,
  canDrag,
  draggingEventId,
  pendingEventId,
  categoriesById,
  onStartDrag,
  consumeSuppressClick,
  columnRef,
}: {
  day: Date;
  events: CalendarEventDTO[];
  hours: number[];
  onSlotClick: (start: Date) => void;
  onEventClick: (event: CalendarEventDTO) => void;
  canDrag: boolean;
  draggingEventId: string | null;
  pendingEventId: string | null;
  categoriesById: Record<string, EventCategoryDTO>;
  onStartDrag: (event: CalendarEventDTO, mode: DragMode, e: React.PointerEvent) => void;
  consumeSuppressClick: () => boolean;
  columnRef: (el: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), day));
  const positioned = layoutDayEvents(dayEvents);
  const today = isSameDay(day, new Date());

  function handleColumnClick(clientY: number) {
    const rect = localRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetY = Math.max(0, clientY - rect.top);
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snapped = snapMinutes(rawMinutes);
    const start = new Date(day);
    start.setHours(RANGE_START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + snapped);
    onSlotClick(start);
  }

  return (
    <div className="min-w-[140px] flex-1 border-r border-border last:border-r-0">
      <div
        className={cn(
          "flex h-10 items-center justify-center border-b border-border text-sm",
          today ? "bg-forest-50 font-semibold text-forest-600" : "text-ink-muted",
        )}
      >
        {formatDayHeader(day)}
      </div>
      <div
        ref={(el) => {
          localRef.current = el;
          columnRef(el);
        }}
        className="relative cursor-pointer"
        style={{ height: GRID_HEIGHT }}
        onClick={(e) => {
          if (consumeSuppressClick()) return;
          handleColumnClick(e.clientY);
        }}
      >
        {hours.map((hour, i) => (
          <div
            key={hour}
            className={cn("absolute inset-x-0 border-t border-border", i === 0 && "border-t-0")}
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}
        {positioned.map(({ event, col, totalCols }) => {
          const { top, height } = eventPixelStyle(event.startAt, event.endAt);
          const isDragging = draggingEventId === event.id;
          const isPending = pendingEventId === event.id;
          const widthPct = 100 / totalCols;
          const leftPct = col * widthPct;
          const category = event.categoryId ? categoriesById[event.categoryId] : undefined;
          return (
            <div
              key={event.id}
              /**
               * Sous-lot C4 — bug trouvé en vérifiant l'anneau de conflit en direct :
               * `overflow-hidden` ici (bornes identiques à celles du bouton, aucune
               * marge) rognait tout ce qui dépasse la boîte du bouton — pas seulement
               * le nouvel anneau, mais aussi la pastille d'invitation en attente
               * (sous-lot A/C, `-right-1 -top-1`) qui était donc déjà invisible en
               * pratique avant ce correctif. Le bouton a déjà son propre
               * `overflow-hidden` (troncature du titre) : celui du wrapper ne servait
               * à rien d'observable, seulement à rogner les indicateurs en débordement.
               */
              className="absolute"
              style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%`, zIndex: isDragging ? 50 : 10 + col }}
            >
              <button
                type="button"
                onPointerDown={(e) => onStartDrag(event, "move", e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (consumeSuppressClick()) return;
                  onEventClick(event);
                }}
                className={cn(
                  "relative h-full w-full overflow-hidden rounded-md px-1.5 py-1 text-left text-xs text-white shadow-flat hover:brightness-95",
                  canDrag && !isPending && "cursor-grab active:cursor-grabbing",
                  isDragging && "opacity-80 ring-2 ring-white",
                  isPending && "opacity-50",
                )}
                style={{
                  backgroundColor: TYPE_COLOR[event.type],
                  // Liseré de catégorie (sous-lot C1) + anneau de conflit (sous-lot C4),
                  // composés dans le même box-shadow — le fond reste piloté par le type.
                  boxShadow:
                    [
                      category ? `inset 3px 0 0 ${category.borderColor}` : null,
                      event.conflictSeverity
                        ? `0 0 0 2px ${TYPE_COLOR[event.type]}, 0 0 0 4px ${CONFLICT_SEVERITY_COLOR[event.conflictSeverity]}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || undefined,
                }}
                title={[
                  event.title,
                  category ? `Catégorie : ${category.name}` : null,
                  event.hasPendingInvitation ? "Invitation en attente de votre réponse" : null,
                  event.conflictSeverity ? CONFLICT_SEVERITY_LABEL[event.conflictSeverity] : null,
                ]
                  .filter(Boolean)
                  .join(" — ")}
                disabled={isPending}
              >
                <p className="truncate font-medium">{event.title}</p>
                {height > 32 ? (
                  <p className="truncate opacity-90">
                    {new Date(event.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}–
                    {new Date(event.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : null}
              </button>
              {event.hasPendingInvitation ? (
                <span
                  className="pointer-events-none absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-status-warning"
                  aria-hidden
                />
              ) : null}
              {canDrag && !isPending ? (
                <>
                  <div
                    className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                    onPointerDown={(e) => onStartDrag(event, "resize-start", e)}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                    onPointerDown={(e) => onStartDrag(event, "resize-end", e)}
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
