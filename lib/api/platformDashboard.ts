import { apiClient } from "@/lib/api/client";

export interface PlatformDashboardStatsDTO {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  calls: { total: number };
}

export function getDashboardStats(accessToken: string) {
  return apiClient.get<PlatformDashboardStatsDTO>("/platform/dashboard", accessToken);
}
