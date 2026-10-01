import { apiClient } from "@/lib/api/client";

export interface PlatformDashboardStatsDTO {
  /** total/active/suspended excluent les supprimées ; `deleted` les compte à part. */
  organizations: { total: number; active: number; suspended: number; deleted: number };
  /** Organisations actives uniquement. `connected` = lastSeenAt dans les 15 dernières minutes (pas du temps réel). */
  users: { total: number; connected: number };
  calls: { total: number };
}

export function getDashboardStats(accessToken: string) {
  return apiClient.get<PlatformDashboardStatsDTO>("/platform/dashboard", accessToken);
}
