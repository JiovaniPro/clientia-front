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
}

export interface ListRemindersFilters {
  status?: ReminderStatus;
  from?: string;
  to?: string;
}

/** §5.9 — toujours scopé au créateur côté backend (pas de vue "tous les rappels"), voir modules/reminders/service.ts. */
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
