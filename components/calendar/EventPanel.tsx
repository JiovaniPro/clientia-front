"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TYPE_LABEL } from "@/components/calendar/CalendarGrid";
import type { CallDTO } from "@/lib/api/calls";
import { getCall, listCalls } from "@/lib/api/calls";
import { ApiError } from "@/lib/api/client";
import type {
  AttendeeRole,
  CalendarEventDTO,
  CreateEventInput,
  EventAttendeeDTO,
  EventCategoryDTO,
  EventReminderDTO,
  EventType,
  ReminderMethod,
} from "@/lib/api/calendar";
import {
  addAttendee,
  createEvent,
  createEventCategory,
  createReminder,
  deleteEvent,
  deleteEventCategory,
  deleteReminder,
  getAgentAvailability,
  getEvent,
  listEventCategories,
  listReminders,
  removeAttendee,
  updateAttendeeStatus,
  updateEvent,
} from "@/lib/api/calendar";
import { toDatetimeLocal } from "@/lib/calendar/dateUtils";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { notifyNotificationsBadgeStale } from "@/lib/notifications/badgeSignal";

const EVENT_TYPES: EventType[] = ["MEETING", "PERSONAL", "BLOCKED_TIME", "REMINDER_EVENT", "APPOINTMENT"];

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE_DE_CONFIRMATION: "En attente de confirmation",
  CONFIRME: "Confirmé",
  ANNULE: "Annulé",
  REFUSE: "Refusé",
};

const ATTENDEE_ROLE_LABEL: Record<AttendeeRole, string> = {
  REQUIRED: "Requis",
  OPTIONAL: "Optionnel",
  ORGANIZER: "Organisateur",
};

const ATTENDEE_STATUS_LABEL: Record<EventAttendeeDTO["status"], string> = {
  PENDING: "En attente",
  ACCEPTED: "Accepté",
  DECLINED: "Décliné",
  TENTATIVE: "Provisoire",
  DELEGATED: "Délégué",
};

const ATTENDEE_STATUS_CLASS: Record<EventAttendeeDTO["status"], string> = {
  PENDING: "text-ink-muted",
  ACCEPTED: "text-forest-600",
  DECLINED: "text-status-danger",
  TENTATIVE: "text-status-warning",
  DELEGATED: "text-ink-muted",
};

const REMINDER_METHOD_LABEL: Record<ReminderMethod, string> = {
  POPUP: "Popup (application)",
  EMAIL: "E-mail",
  SOUND: "Popup + son",
};

/**
 * Sous-lot C3 — limite honnête à afficher dès le choix de la méthode (pas
 * seulement documentée dans le code) : popup/son dépendent d'un onglet ouvert,
 * aucune infra de push n'existe dans ce projet (voir jobs/eventReminders.ts côté
 * backend et lib/reminders/useReminderPopups.ts côté frontend).
 */
const REMINDER_METHOD_HELP: Record<ReminderMethod, string> = {
  POPUP: "Ne s'affiche que si l'application est ouverte dans un onglet au moment du rappel.",
  SOUND: "Comme Popup, plus un son — ne fonctionne que si l'application est ouverte dans un onglet.",
  EMAIL: "Fonctionne même application fermée — envoyé à votre adresse de compte, avec réessais en cas d'échec.",
};

interface EventPanelProps {
  /** Présent = édition, absent = création (panneau de création rapide §6.7). */
  event?: CalendarEventDTO;
  /** Créneau cliqué sur la grille, pré-rempli en création. */
  initialStart?: Date;
  /**
   * §P0.4 "suite du flux" / §P1.1 — pont dossier→calendrier : posé par
   * CalendarProPage quand un client "en attente de planification" est actif
   * (bannière). Pré-remplit un rendez-vous avec l'appel et l'agent déjà connus,
   * sans empêcher l'utilisateur de les changer avant d'enregistrer.
   */
  prefill?: { title: string; callId: string; agentRdvId?: string };
  calendarId: string;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

/**
 * Panneau de création rapide (§6.7) et d'édition minimale. Volontairement sans
 * glisser-déposer/redimensionnement (sous-lot B) ni récurrence/conflits/
 * participants/rappels d'événement (sous-lot C) ni workflow accepter/refuser
 * (sous-lot D, §P0.5) — un rendez-vous créé ici reste visible en lecture seule
 * pour son statut, modifiable seulement via le futur écran du sous-lot D.
 */
export function EventPanel({
  event,
  initialStart,
  prefill,
  calendarId,
  canWrite,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: EventPanelProps) {
  const { authedFetch, user } = useAuth();
  const isEdit = Boolean(event);
  /**
   * Sous-lot C3 — décision actée : un rappel concerne l'organisateur uniquement
   * (pas de diffusion aux participants). `canWrite` (organisateur OU agent RDV OU
   * calendar.viewAll) est une gate plus large que celle-ci, volontairement — gérer
   * les rappels de quelqu'un d'autre n'a pas de sens même pour qui peut éditer
   * l'événement.
   */
  const isOrganizer = Boolean(event && user && event.organizerId === user.id);

  const defaultStart = event ? new Date(event.startAt) : (initialStart ?? new Date());
  const defaultEnd = event ? new Date(event.endAt) : new Date(defaultStart.getTime() + 60 * 60_000);

  const [title, setTitle] = useState(event?.title ?? prefill?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? (prefill ? "APPOINTMENT" : "MEETING"));
  const [startAt, setStartAt] = useState(toDatetimeLocal(defaultStart));
  const [endAt, setEndAt] = useState(toDatetimeLocal(defaultEnd));
  const [callId, setCallId] = useState(event?.callId ?? prefill?.callId ?? "");
  const [agentRdvId, setAgentRdvId] = useState(event?.agentRdvId ?? prefill?.agentRdvId ?? "");
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? "");
  const [categories, setCategories] = useState<EventCategoryDTO[]>([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#c2410c");
  const [calls, setCalls] = useState<CallDTO[]>([]);
  const [agents, setAgents] = useState<UserListItemDTO[]>([]);
  const [agentBusyCount, setAgentBusyCount] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<EventAttendeeDTO[]>([]);
  const [attendeeMode, setAttendeeMode] = useState<"internal" | "external">("internal");
  const [internalSearch, setInternalSearch] = useState("");
  const [internalResults, setInternalResults] = useState<UserListItemDTO[]>([]);
  const [selectedInternalUser, setSelectedInternalUser] = useState<UserListItemDTO | null>(null);
  const [newAttendeeEmail, setNewAttendeeEmail] = useState("");
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [newAttendeeRole, setNewAttendeeRole] = useState<AttendeeRole>("REQUIRED");
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [isInvitingAll, setIsInvitingAll] = useState(false);
  const [reminders, setReminders] = useState<EventReminderDTO[]>([]);
  const [newReminderMinutes, setNewReminderMinutes] = useState("15");
  const [newReminderMethod, setNewReminderMethod] = useState<ReminderMethod>("POPUP");
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    authedFetch((token) => listEventCategories(token))
      .then(setCategories)
      .catch(() => setError("Impossible de charger les catégories."));
  }, [authedFetch]);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setError(null);
    try {
      const category = await authedFetch((token) =>
        createEventCategory({ name: newCategoryName.trim(), color: newCategoryColor, borderColor: newCategoryColor }, token),
      );
      setCategories((prev) => [...prev, category]);
      setCategoryId(category.id);
      setIsCreatingCategory(false);
      setNewCategoryName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer la catégorie.");
    }
  }

  async function handleDeleteCategory(id: string) {
    setError(null);
    try {
      await authedFetch((token) => deleteEventCategory(id, token));
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (categoryId === id) setCategoryId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer la catégorie.");
    }
  }

  /**
   * `listEvents` (grille) ne renvoie pas `attendees` — évité côté backend pour ne
   * pas alourdir chaque chargement de grille d'une jointure inutile la plupart du
   * temps. On recharge donc le détail complet à l'ouverture en édition, comme pour
   * tout ce qui n'est utile qu'au panneau (agents, appels…).
   */
  useEffect(() => {
    if (!isEdit || !event) return;
    authedFetch((token) => getEvent(event.id, token))
      .then((full) => setAttendees(full.attendees ?? []))
      .catch(() => setError("Impossible de charger les participants."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, event?.id, authedFetch]);

  /**
   * Réservé à l'organisateur (403 backend sinon) — on n'appelle même pas
   * l'endpoint pour un non-organisateur, pas la peine de déclencher un échec
   * attendu à chaque ouverture du panneau.
   */
  useEffect(() => {
    if (!isEdit || !event || !isOrganizer) return;
    authedFetch((token) => listReminders(event.id, token))
      .then(setReminders)
      .catch(() => setError("Impossible de charger les rappels."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, event?.id, isOrganizer, authedFetch]);

  async function handleAddReminder() {
    if (!event) return;
    const minutesBefore = Number(newReminderMinutes);
    if (!Number.isInteger(minutesBefore) || minutesBefore < 1) {
      setError("Le délai doit être un nombre entier de minutes, supérieur à 0.");
      return;
    }
    setError(null);
    setIsAddingReminder(true);
    try {
      const reminder = await authedFetch((token) =>
        createReminder(event.id, { minutesBefore, method: newReminderMethod }, token),
      );
      setReminders((prev) => [...prev, reminder].sort((a, b) => a.minutesBefore - b.minutesBefore));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce rappel.");
    } finally {
      setIsAddingReminder(false);
    }
  }

  async function handleDeleteReminder(reminderId: string) {
    if (!event) return;
    setError(null);
    try {
      await authedFetch((token) => deleteReminder(event.id, reminderId, token));
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer ce rappel.");
    }
  }

  /**
   * §C2 point 2 — sélecteur de participant interne par recherche plutôt que par
   * email tapé à la main : `/users` n'a pas de recherche par nom avant ce lot (même
   * gap que le sélecteur d'agent RDV), résolu ici par le nouveau paramètre
   * `search`. Debounce identique au filtre de recherche de la page "Journal".
   */
  useEffect(() => {
    if (attendeeMode !== "internal" || internalSearch.trim().length < 2) {
      setInternalResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      authedFetch((token) => listUsers({ search: internalSearch.trim() }, token))
        .then(setInternalResults)
        .catch(() => setError("Impossible de rechercher les utilisateurs."));
    }, 300);
    return () => clearTimeout(timeout);
  }, [attendeeMode, internalSearch, authedFetch]);

  async function handleAddAttendee() {
    if (!event) return;
    const email = attendeeMode === "internal" ? selectedInternalUser?.email : newAttendeeEmail.trim();
    if (!email) return;
    setError(null);
    setIsAddingAttendee(true);
    try {
      const attendee = await authedFetch((token) =>
        addAttendee(
          event.id,
          {
            email,
            // Ignoré côté serveur si l'email résout un compte existant (voir
            // addAttendee) — n'a d'effet réel que pour un externe.
            name: attendeeMode === "external" ? newAttendeeName.trim() || undefined : undefined,
            role: newAttendeeRole,
          },
          token,
        ),
      );
      setAttendees((prev) => [...prev, attendee]);
      setSelectedInternalUser(null);
      setInternalSearch("");
      setInternalResults([]);
      setNewAttendeeEmail("");
      setNewAttendeeName("");
      setNewAttendeeRole("REQUIRED");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce participant.");
    } finally {
      setIsAddingAttendee(false);
    }
  }

  /**
   * Point 1 des retours de test (nouveau par rapport au cahier des charges) —
   * invite en une fois tous les membres actifs de l'organisation, résolus comme
   * des invitations individuelles (chaque email interne déclenche la même
   * notification EVENT_INVITATION, voir addAttendee côté backend). Exclut
   * l'organisateur courant (déjà rattaché à l'événement, pas un "participant" au
   * sens de cette liste) et ceux déjà invités, pour éviter des 409 en rafale.
   */
  async function handleInviteAll() {
    if (!event) return;
    setError(null);
    setIsInvitingAll(true);
    try {
      const activeUsers = await authedFetch((token) => listUsers({ isActive: true }, token));
      const alreadyInvited = new Set(attendees.map((a) => a.email));
      const toInvite = activeUsers.filter((u) => u.id !== user?.id && !alreadyInvited.has(u.email.toLowerCase()));

      const results = await Promise.allSettled(
        toInvite.map((u) => authedFetch((token) => addAttendee(event.id, { email: u.email, role: "REQUIRED" }, token))),
      );
      const failures = results.filter((r) => r.status === "rejected").length;

      const full = await authedFetch((token) => getEvent(event.id, token));
      setAttendees(full.attendees ?? []);

      if (failures > 0) {
        setError(`${failures} participant(s) n'ont pas pu être invités (déjà invités entre-temps ?).`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'inviter tous les membres.");
    } finally {
      setIsInvitingAll(false);
    }
  }

  async function handleRemoveAttendee(attendeeId: string) {
    if (!event) return;
    setError(null);
    try {
      await authedFetch((token) => removeAttendee(event.id, attendeeId, token));
      setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer ce participant.");
    }
  }

  async function handleRespondAttendee(attendeeId: string, status: "ACCEPTED" | "DECLINED") {
    if (!event) return;
    setError(null);
    try {
      const updated = await authedFetch((token) => updateAttendeeStatus(event.id, attendeeId, { status }, token));
      setAttendees((prev) => prev.map((a) => (a.id === attendeeId ? updated : a)));
      // Le badge du rail (SideRail) reste affiché tant qu'une invitation est PENDING,
      // indépendamment de la route — sans ce signal, il ne se rafraîchirait qu'à la
      // prochaine navigation puisque /calendar-pro ne change pas de route ici.
      notifyNotificationsBadgeStale();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer votre réponse.");
    }
  }

  useEffect(() => {
    if (type !== "APPOINTMENT") return;
    authedFetch((token) => listCalls({ pageSize: 100 }, token))
      .then((res) => setCalls(res.items))
      .catch(() => setError("Impossible de charger la liste des appels."));
    authedFetch((token) => listUsers({ role: "Agent RDV", isActive: true }, token))
      .then(setAgents)
      .catch(() => setError("Impossible de charger la liste des agents RDV."));
  }, [type, authedFetch]);

  /**
   * Point 5 des retours de test — §P1.1 : compteur disponible/occupé au moment
   * d'assigner un agent RDV sur CE créneau précis (pas son agenda complet). Ne
   * bloque rien ici (juste informatif) — le vrai rejet §P0.5 se fait côté serveur
   * à l'enregistrement, ceci évite seulement de le découvrir après coup.
   */
  useEffect(() => {
    if (type !== "APPOINTMENT" || !agentRdvId || !startAt || !endAt) {
      setAgentBusyCount(null);
      return;
    }
    authedFetch((token) =>
      getAgentAvailability(
        {
          agentRdvId,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          excludeEventId: event?.id,
        },
        token,
      ),
    )
      .then((res) => setAgentBusyCount(res.busyCount))
      .catch(() => setAgentBusyCount(null));
  }, [type, agentRdvId, startAt, endAt, event?.id, authedFetch]);

  /**
   * Gap trouvé en vérifiant le pont §P1.1 en direct : l'appel pré-rempli (celui du
   * client "en attente de planification") n'apparaît pas forcément dans les 100
   * appels les plus récents ci-dessus — le <select> affichait "Sélectionner…" au
   * lieu du bon appel (la valeur React restait correcte, mais visuellement
   * trompeur, et un changement accidentel de sélection aurait silencieusement
   * remplacé le bon appel). On force son ajout à la liste s'il en est absent.
   */
  useEffect(() => {
    if (!prefill?.callId) return;
    if (calls.some((c) => c.id === prefill.callId)) return;
    authedFetch((token) => getCall(prefill.callId, token))
      .then((call) => setCalls((prev) => (prev.some((c) => c.id === call.id) ? prev : [call, ...prev])))
      .catch(() => setError("Impossible de charger l'appel pré-rempli."));
    // ne dépend que de l'ID pré-rempli : `calls` changerait à chaque fetch et créerait une boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.callId, authedFetch]);

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !startAt || !endAt) {
      setError("Le titre et les horaires sont obligatoires.");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    if (type === "APPOINTMENT" && !callId) {
      setError("Un rendez-vous doit être rattaché à un appel.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && event) {
        await authedFetch((token) =>
          updateEvent(
            event.id,
            {
              title,
              description: description || undefined,
              startAt: new Date(startAt).toISOString(),
              endAt: new Date(endAt).toISOString(),
              categoryId: categoryId || null,
              type,
              ...(type === "APPOINTMENT" ? { agentRdvId: agentRdvId || undefined, callId: callId || undefined } : {}),
            },
            token,
          ),
        );
      } else {
        const input: CreateEventInput = {
          calendarId,
          title,
          description: description || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          type,
          categoryId: categoryId || undefined,
          ...(type === "APPOINTMENT" ? { callId, agentRdvId: agentRdvId || undefined } : {}),
        };
        await authedFetch((token) => createEvent(input, token));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await authedFetch((token) => deleteEvent(event.id, token));
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer cet événement.");
      setIsSubmitting(false);
    }
  }

  const readOnly = isEdit && !canWrite;

  return (
    <Modal title={isEdit ? "Modifier l'événement" : "Nouvel événement"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} required />

        {readOnly ? (
          <p className="text-sm text-ink-muted">
            Type : <span className="font-medium text-ink">{TYPE_LABEL[type]}</span>
            {event?.status ? (
              <>
                {" "}
                — statut : <span className="font-medium text-ink">{APPOINTMENT_STATUS_LABEL[event.status]}</span>
              </>
            ) : null}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            {isEdit && event && event.type !== type ? (
              <p className="text-xs text-status-warning">
                {type === "APPOINTMENT"
                  ? "Devient un rendez-vous à l'enregistrement — un appel rattaché est requis, §P0.5 sera vérifié."
                  : event.type === "APPOINTMENT"
                    ? "N'est plus un rendez-vous à l'enregistrement — statut et agent RDV seront effacés."
                    : null}
              </p>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Début" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={readOnly} required />
          <Input label="Fin" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} disabled={readOnly} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink" htmlFor="event-description">
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={readOnly}
            rows={2}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-ink" htmlFor="event-category">
              Catégorie
            </label>
            <button
              type="button"
              className="text-xs font-medium text-forest-600 hover:underline disabled:opacity-60"
              onClick={() => setIsCreatingCategory((v) => !v)}
              disabled={readOnly}
            >
              {isCreatingCategory ? "Annuler" : "+ Nouvelle catégorie"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              id="event-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={readOnly}
              className="flex-1"
            >
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {categoryId && !readOnly ? (
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-border"
                style={{ backgroundColor: categories.find((c) => c.id === categoryId)?.color }}
                title="Couleur de la catégorie"
              />
            ) : null}
            {categoryId && !readOnly ? (
              <button
                type="button"
                className="whitespace-nowrap text-xs text-status-danger hover:underline"
                onClick={() => handleDeleteCategory(categoryId)}
                title="Supprime la catégorie elle-même (pas seulement son affectation ici) — les autres événements qui l'utilisent perdent aussi le tag."
              >
                Supprimer la catégorie
              </button>
            ) : null}
          </div>
          {isCreatingCategory ? (
            <div className="flex items-end gap-2 rounded-md border border-border bg-surface-subtle p-2.5">
              <Input
                label="Nom"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1"
              />
              <Input
                label="Couleur"
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className="w-14 p-1"
              />
              <Button type="button" size="sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                Créer
              </Button>
            </div>
          ) : null}
        </div>

        {isEdit && event ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink">Participants</label>
              {!readOnly ? (
                <button
                  type="button"
                  className="text-xs font-medium text-forest-600 hover:underline disabled:opacity-60"
                  onClick={handleInviteAll}
                  disabled={isInvitingAll}
                  title="Ajoute tous les utilisateurs actifs de l'organisation comme participants internes."
                >
                  {isInvitingAll ? "Invitation en cours…" : "Inviter tout le monde"}
                </button>
              ) : null}
            </div>
            {attendees.length === 0 ? <p className="text-sm text-ink-muted">Aucun participant pour l'instant.</p> : null}
            <ul className="flex flex-col gap-1.5">
              {attendees.map((a) => {
                const isSelf = a.userId === user?.id;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {a.name ?? a.email}
                        {a.userId ? (
                          <span className="ml-1.5 text-xs text-forest-600">(interne)</span>
                        ) : (
                          <span className="ml-1.5 text-xs text-ink-faint">(externe)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {a.email} · {ATTENDEE_ROLE_LABEL[a.role]} ·{" "}
                        <span className={ATTENDEE_STATUS_CLASS[a.status]}>{ATTENDEE_STATUS_LABEL[a.status]}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isSelf && a.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            className="text-xs font-medium text-forest-600 hover:underline"
                            onClick={() => handleRespondAttendee(a.id, "ACCEPTED")}
                          >
                            Accepter
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-status-danger hover:underline"
                            onClick={() => handleRespondAttendee(a.id, "DECLINED")}
                          >
                            Décliner
                          </button>
                        </>
                      ) : null}
                      {!readOnly ? (
                        <button
                          type="button"
                          className="text-xs text-ink-faint hover:text-status-danger hover:underline"
                          onClick={() => handleRemoveAttendee(a.id)}
                          title="Retirer ce participant de l'événement"
                        >
                          Retirer
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!readOnly ? (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-subtle p-2.5">
                <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5 text-xs">
                  <button
                    type="button"
                    className={`flex-1 rounded px-2 py-1 font-medium ${
                      attendeeMode === "internal" ? "bg-forest-600 text-white" : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => {
                      setAttendeeMode("internal");
                      setNewAttendeeEmail("");
                      setNewAttendeeName("");
                    }}
                  >
                    Interne (rechercher)
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded px-2 py-1 font-medium ${
                      attendeeMode === "external" ? "bg-forest-600 text-white" : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => {
                      setAttendeeMode("external");
                      setSelectedInternalUser(null);
                      setInternalSearch("");
                      setInternalResults([]);
                    }}
                  >
                    Externe (email)
                  </button>
                </div>

                {attendeeMode === "internal" ? (
                  selectedInternalUser ? (
                    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm">
                      <span className="text-ink">
                        {`${selectedInternalUser.firstName ?? ""} ${selectedInternalUser.lastName ?? ""}`.trim() ||
                          selectedInternalUser.email}{" "}
                        <span className="text-ink-muted">({selectedInternalUser.email})</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-ink-faint hover:text-status-danger hover:underline"
                        onClick={() => setSelectedInternalUser(null)}
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        label="Rechercher un utilisateur"
                        placeholder="Nom ou email…"
                        value={internalSearch}
                        onChange={(e) => setInternalSearch(e.target.value)}
                      />
                      {internalResults.length > 0 ? (
                        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-raised">
                          {internalResults.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-surface-subtle"
                                onClick={() => {
                                  setSelectedInternalUser(u);
                                  setInternalResults([]);
                                }}
                              >
                                {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email}{" "}
                                <span className="text-ink-muted">({u.email})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )
                ) : (
                  <>
                    <Input
                      label="Email"
                      type="email"
                      placeholder="prenom.nom@exemple.com"
                      value={newAttendeeEmail}
                      onChange={(e) => setNewAttendeeEmail(e.target.value)}
                    />
                    <Input
                      label="Nom (optionnel)"
                      value={newAttendeeName}
                      onChange={(e) => setNewAttendeeName(e.target.value)}
                    />
                  </>
                )}

                <div className="flex items-end gap-2">
                  <Select
                    label="Rôle"
                    value={newAttendeeRole}
                    onChange={(e) => setNewAttendeeRole(e.target.value as AttendeeRole)}
                    className="flex-1"
                  >
                    <option value="REQUIRED">Requis</option>
                    <option value="OPTIONAL">Optionnel</option>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddAttendee}
                    disabled={
                      (attendeeMode === "internal" ? !selectedInternalUser : !newAttendeeEmail.trim()) ||
                      isAddingAttendee
                    }
                  >
                    Inviter
                  </Button>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-ink-muted">
              Interne : sélectionné par recherche, rattaché automatiquement à son compte. Externe : email libre, sans
              compte.
            </p>
          </div>
        ) : null}

        {isEdit && event && isOrganizer ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Rappels</label>
            <p className="text-xs text-ink-muted">Ce rappel te concerne en tant qu'organisateur de cet événement.</p>
            {reminders.length === 0 ? <p className="text-sm text-ink-muted">Aucun rappel configuré.</p> : null}
            <ul className="flex flex-col gap-1.5">
              {reminders.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-sm"
                >
                  <span className="text-ink">
                    {r.minutesBefore} min avant · {REMINDER_METHOD_LABEL[r.method]}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-ink-faint hover:text-status-danger hover:underline"
                    onClick={() => handleDeleteReminder(r.id)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-subtle p-2.5">
              <div className="flex items-end gap-2">
                <Input
                  label="Minutes avant"
                  type="number"
                  min={1}
                  max={10080}
                  value={newReminderMinutes}
                  onChange={(e) => setNewReminderMinutes(e.target.value)}
                  className="w-28"
                />
                <Select
                  label="Méthode"
                  value={newReminderMethod}
                  onChange={(e) => setNewReminderMethod(e.target.value as ReminderMethod)}
                  className="flex-1"
                >
                  <option value="POPUP">{REMINDER_METHOD_LABEL.POPUP}</option>
                  <option value="EMAIL">{REMINDER_METHOD_LABEL.EMAIL}</option>
                  <option value="SOUND">{REMINDER_METHOD_LABEL.SOUND}</option>
                </Select>
                <Button type="button" size="sm" onClick={handleAddReminder} disabled={isAddingReminder}>
                  Ajouter
                </Button>
              </div>
              <p className="text-xs text-ink-muted">{REMINDER_METHOD_HELP[newReminderMethod]}</p>
            </div>
          </div>
        ) : isEdit && event && canWrite ? (
          <p className="text-xs text-ink-muted">Seul l'organisateur peut gérer les rappels de cet événement.</p>
        ) : null}

        {type === "APPOINTMENT" ? (
          <div className="space-y-3 rounded-md border border-terracotta-500/30 bg-terracotta-500/10 p-3">
            {!isEdit || event?.type !== "APPOINTMENT" ? (
              <Select label="Appel rattaché" value={callId} onChange={(e) => setCallId(e.target.value)} disabled={readOnly}>
                <option value="">Sélectionner…</option>
                {calls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.toNumber} — {c.toNumber}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select label="Agent RDV" value={agentRdvId} onChange={(e) => setAgentRdvId(e.target.value)} disabled={readOnly}>
              <option value="">Non assigné</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || a.email}
                </option>
              ))}
            </Select>
            {agentRdvId && agentBusyCount !== null ? (
              <p
                className={`text-xs font-medium ${agentBusyCount > 0 ? "text-status-danger" : "text-forest-600"}`}
                title="Compteur agrégé sur ce créneau uniquement — §P1.1 : jamais le détail des événements de l'agent, pour préserver la confidentialité de son agenda personnel."
              >
                {agentBusyCount > 0
                  ? `Occupé — ${agentBusyCount} rendez-vous déjà actif${agentBusyCount > 1 ? "s" : ""} sur ce créneau`
                  : "Disponible sur ce créneau"}
              </p>
            ) : null}
            <p className="text-xs text-ink-muted">
              §P0.5 : un seul rendez-vous actif par appel, pas de chevauchement pour un même agent RDV — vérifié par le
              backend à l'enregistrement.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-status-danger">{error}</p> : null}

        <div className="flex justify-between gap-2 pt-2">
          {isEdit && canDelete ? (
            <Button variant="danger" onClick={handleDelete} disabled={isSubmitting}>
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              {readOnly ? "Fermer" : "Annuler"}
            </Button>
            {!readOnly ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
