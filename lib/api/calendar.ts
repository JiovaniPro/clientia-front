import { apiClient, buildQuery } from "@/lib/api/client";

export type EventType = "APPOINTMENT" | "MEETING" | "PERSONAL" | "BLOCKED_TIME" | "REMINDER_EVENT";
export type EventAvailability = "FREE" | "TENTATIVE" | "BUSY" | "OUT_OF_OFFICE";
export type EventPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type AppointmentStatus = "EN_ATTENTE_DE_CONFIRMATION" | "CONFIRME" | "ANNULE" | "REFUSE";

export interface CalendarDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  isVisible: boolean;
  isDefault: boolean;
  timezone: string;
  description: string | null;
  isGlobal: boolean;
}

export function listCalendars(accessToken: string) {
  return apiClient.get<CalendarDTO[]>("/calendars", accessToken);
}

export interface CreateCalendarInput {
  name: string;
  color: string;
  isVisible?: boolean;
  isDefault?: boolean;
  timezone?: string;
  description?: string;
}

export function createCalendar(input: CreateCalendarInput, accessToken: string) {
  return apiClient.post<CalendarDTO>("/calendars", input, accessToken);
}

export interface EventCategoryDTO {
  id: string;
  userId: string;
  name: string;
  color: string;
  borderColor: string;
  textColor: string;
  icon: string | null;
  createdAt: string;
}

/** Personnelles, comme les calendriers — pas de partage entre utilisateurs (§C1). */
export function listEventCategories(accessToken: string) {
  return apiClient.get<EventCategoryDTO[]>("/event-categories", accessToken);
}

export interface CreateEventCategoryInput {
  name: string;
  color: string;
  borderColor: string;
  textColor?: string;
  icon?: string;
}

export function createEventCategory(input: CreateEventCategoryInput, accessToken: string) {
  return apiClient.post<EventCategoryDTO>("/event-categories", input, accessToken);
}

export function deleteEventCategory(id: string, accessToken: string) {
  return apiClient.delete<void>(`/event-categories/${id}`, accessToken);
}

export interface CalendarEventDTO {
  id: string;
  organizationId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  isAllDay: boolean;
  type: EventType;
  availability: EventAvailability;
  priority: EventPriority;
  recurrenceRule: string | null;
  recurrenceId: string | null;
  isRecurring: boolean;
  exceptionDates: unknown;
  isPrivate: boolean;
  categoryId: string | null;
  tags: string[];
  organizerId: string;
  callId: string | null;
  clientId: string | null;
  agentRdvId: string | null;
  status: AppointmentStatus | null;
  callNotesSnapshot: string | null;
  agentComment: string | null;
  createdAt: string;
  updatedAt: string;
  /** Présent uniquement sur une occurrence virtuelle d'un événement récurrent (pas utilisé au sous-lot A). */
  sourceEventId?: string;
  isVirtualOccurrence?: true;
  /** Présent uniquement sur la réponse de `getEvent` (détail) — absent de `listEvents` (grille, pas de jointure). */
  attendees?: EventAttendeeDTO[];
  /**
   * Présent uniquement sur `listEvents` (point 3 des retours de test) : vrai si
   * l'utilisateur courant a une invitation `PENDING` sur cet événement — dérivé
   * côté serveur, pas la liste complète des participants (voir `getEvent` pour ça).
   */
  hasPendingInvitation?: boolean;
}

export type AttendeeRole = "REQUIRED" | "OPTIONAL" | "ORGANIZER";
export type AttendeeStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "TENTATIVE" | "DELEGATED";

export interface EventAttendeeDTO {
  id: string;
  eventId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: AttendeeRole;
  status: AttendeeStatus;
  respondedAt: string | null;
  comment: string | null;
}

/**
 * Un seul champ email pour interne (résolu vers un compte existant) et externe
 * (§4.13 / §P1.1) — voir modules/calendar/schema.ts::addAttendeeSchema côté backend.
 */
export interface AddAttendeeInput {
  email: string;
  name?: string;
  role?: AttendeeRole;
}

export function addAttendee(eventId: string, input: AddAttendeeInput, accessToken: string) {
  return apiClient.post<EventAttendeeDTO>(`/calendar-events/${eventId}/attendees`, input, accessToken);
}

export function removeAttendee(eventId: string, attendeeId: string, accessToken: string) {
  return apiClient.delete<void>(`/calendar-events/${eventId}/attendees/${attendeeId}`, accessToken);
}

export function updateAttendeeStatus(
  eventId: string,
  attendeeId: string,
  input: { status: AttendeeStatus; comment?: string },
  accessToken: string,
) {
  return apiClient.patch<EventAttendeeDTO>(`/calendar-events/${eventId}/attendees/${attendeeId}/status`, input, accessToken);
}

/**
 * Point 5 des retours de test — §P1.1 : compteur agrégé, pas le contenu des
 * événements de l'agent (confidentialité de ses événements personnels/privés).
 */
/**
 * Badge du rail (notifications) — exception actionnable : une invitation PENDING
 * garde le badge affiché quelle que soit sa date ou la visite de /notifications,
 * puisque seule une réponse (accepter/décliner) la fait disparaître.
 */
export function getPendingInvitationsCount(accessToken: string) {
  return apiClient.get<{ count: number }>("/calendar-events/pending-invitations-count", accessToken);
}

export function getAgentAvailability(
  params: { agentRdvId: string; startAt: string; endAt: string; excludeEventId?: string },
  accessToken: string,
) {
  return apiClient.get<{ busyCount: number }>(
    `/calendar-events/agent-availability${buildQuery(params)}`,
    accessToken,
  );
}

export interface ListEventsFilters {
  from: string;
  to: string;
  calendarId?: string;
  type?: EventType;
}

/**
 * Portée par utilisateur côté backend (voir modules/calendar/service.ts::
 * eventAccessFilter) : sans `calendar.viewAll`, ne renvoie que les événements dont
 * l'appelant est organisateur, agent RDV assigné, propriétaire/membre du calendrier
 * (ou calendrier global), ou participant — et jamais un événement `isPrivate`
 * d'un tiers. Gap trouvé et corrigé au sous-lot A : cette portée était absente.
 */
export function listEvents(filters: ListEventsFilters, accessToken: string) {
  // `from`/`to` sont requis (contrairement aux filtres optionnels des autres modules) —
  // TS n'accepte pas le cast direct vers Record<string, ...>, d'où le détour par `unknown`.
  return apiClient.get<CalendarEventDTO[]>(
    `/calendar-events${buildQuery(filters as unknown as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export function getEvent(id: string, accessToken: string) {
  return apiClient.get<CalendarEventDTO>(`/calendar-events/${id}`, accessToken);
}

export interface CreateEventInput {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  isAllDay?: boolean;
  type: EventType;
  availability?: EventAvailability;
  priority?: EventPriority;
  isPrivate?: boolean;
  categoryId?: string;
  tags?: string[];
  callId?: string;
  clientId?: string;
  /** Pertinents uniquement si type = APPOINTMENT. */
  agentRdvId?: string;
  callNotesSnapshot?: string;
  agentComment?: string;
}

export function createEvent(input: CreateEventInput, accessToken: string) {
  return apiClient.post<CalendarEventDTO>("/calendar-events", input, accessToken);
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  /** Modifiable après création (point 3) — voir modules/calendar/service.ts::updateEvent pour la logique de transition. */
  type?: EventType;
  availability?: EventAvailability;
  priority?: EventPriority;
  isPrivate?: boolean;
  /** `null` retire explicitement la catégorie ; absent = inchangé. */
  categoryId?: string | null;
  tags?: string[];
  /** Requis quand `type` devient APPOINTMENT et qu'aucun appel n'était déjà rattaché. */
  callId?: string;
  clientId?: string;
  agentRdvId?: string;
  agentComment?: string;
}

export function updateEvent(id: string, input: UpdateEventInput, accessToken: string) {
  return apiClient.patch<CalendarEventDTO>(`/calendar-events/${id}`, input, accessToken);
}

export function deleteEvent(id: string, accessToken: string) {
  return apiClient.delete<void>(`/calendar-events/${id}`, accessToken);
}

export interface ChangeAppointmentStatusInput {
  status: AppointmentStatus;
  comment?: string;
}

export function changeAppointmentStatus(id: string, input: ChangeAppointmentStatusInput, accessToken: string) {
  return apiClient.patch<CalendarEventDTO>(`/calendar-events/${id}/appointment-status`, input, accessToken);
}

/**
 * Sous-lot C3 — pas de SMS ici : l'enum backend ne le prévoit pas (retiré dès la
 * phase d'architecture), donc aucun sélecteur ne peut jamais le proposer.
 */
export type ReminderMethod = "POPUP" | "EMAIL" | "SOUND";

export interface EventReminderDTO {
  id: string;
  eventId: string;
  minutesBefore: number;
  method: ReminderMethod;
  createdAt: string;
}

/**
 * Réservé à l'organisateur (décision actée) : un 403 backend est attendu pour
 * quiconque d'autre — le panneau événement doit masquer/désactiver cette section
 * plutôt que de laisser l'appel échouer silencieusement.
 */
export function listReminders(eventId: string, accessToken: string) {
  return apiClient.get<EventReminderDTO[]>(`/calendar-events/${eventId}/reminders`, accessToken);
}

export interface CreateReminderInput {
  minutesBefore: number;
  method: ReminderMethod;
}

export function createReminder(eventId: string, input: CreateReminderInput, accessToken: string) {
  return apiClient.post<EventReminderDTO>(`/calendar-events/${eventId}/reminders`, input, accessToken);
}

export function deleteReminder(eventId: string, reminderId: string, accessToken: string) {
  return apiClient.delete<void>(`/calendar-events/${eventId}/reminders/${reminderId}`, accessToken);
}
