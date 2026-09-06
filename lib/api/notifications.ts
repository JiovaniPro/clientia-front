import { apiClient, buildQuery } from "@/lib/api/client";

export type NotificationType =
  | "REMINDER_DUE"
  | "CALL_ASSIGNED"
  | "DAILY_DIGEST"
  | "SYSTEM"
  | "CLIENT_UPDATED_BY_ADMIN"
  | "APPOINTMENT_ASSIGNED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_REFUSED"
  | "APPOINTMENT_UPDATED"
  | "EVENT_INVITATION"
  | "EVENT_REMINDER";

export interface NotificationDTO {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  readAt: string | null;
  meta: unknown;
  createdAt: string;
}

export interface ListNotificationsResponse {
  items: NotificationDTO[];
  unreadCount: number;
  page: number;
  pageSize: number;
}

export interface ListNotificationsFilters {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * §5.10 — toujours scopé au destinataire côté backend. Une notification naît
 * toujours d'un événement métier (voir lib/notifications.ts côté backend) : pas de
 * route de création, seulement lecture + marquage lu.
 */
export function listNotifications(filters: ListNotificationsFilters, accessToken: string) {
  return apiClient.get<ListNotificationsResponse>(
    `/notifications${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export function markNotificationAsRead(id: string, accessToken: string) {
  return apiClient.patch<NotificationDTO>(`/notifications/${id}/read`, undefined, accessToken);
}

export function markAllNotificationsAsRead(accessToken: string) {
  return apiClient.post<void>("/notifications/read-all", undefined, accessToken);
}
