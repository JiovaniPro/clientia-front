import { apiClient, buildQuery } from "@/lib/api/client";

export type ReminderStatus = "PENDING" | "DONE" | "CANCELED";

export interface ReminderDTO {
  id: string;
  organizationId: string;
  userId: string;
  callId: string | null;
  title: string;
  description: string | null;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  /** §5.19 — résolu côté backend pour la colonne "Agent" en vue reminders.viewAll. */
  user: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface ListRemindersFilters {
  status?: ReminderStatus;
  from?: string;
  to?: string;
  /** §5.19 — ignoré sans reminders.viewAll ; même avec elle, exclut structurellement
   * les rappels personnels d'un autre utilisateur, voir modules/reminders/service.ts. */
  userId?: string;
}

/** §5.9/§5.19 — scopé au créateur par défaut ; avec reminders.viewAll, inclut aussi
 * les rappels LIÉS (callId non nul) de toute l'organisation, jamais les personnels
 * des autres — voir modules/reminders/service.ts. */
export function listReminders(filters: ListRemindersFilters, accessToken: string) {
  return apiClient.get<ReminderDTO[]>(
    `/reminders${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export interface CreateReminderInput {
  callId?: string;
  title: string;
  description?: string;
  dueAt: string;
}

export function createReminder(input: CreateReminderInput, accessToken: string) {
  return apiClient.post<ReminderDTO>("/reminders", input, accessToken);
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  dueAt?: string;
  status?: ReminderStatus;
}

export function updateReminder(id: string, input: UpdateReminderInput, accessToken: string) {
  return apiClient.patch<ReminderDTO>(`/reminders/${id}`, input, accessToken);
}

export function deleteReminder(id: string, accessToken: string) {
  return apiClient.delete<void>(`/reminders/${id}`, accessToken);
}
