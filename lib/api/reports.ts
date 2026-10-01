import { apiClient, buildQuery } from "@/lib/api/client";

export interface CallsReportDTO {
  total: number;
  /** Appels de la période dont le statut n'est plus le statut par défaut. */
  qualified: number;
  /** 24 entrées (0–23 h) : appels qualifiés de la période, à l'heure de leur qualification. */
  byHour: { hour: number; count: number }[];
  byStatus: { statusId: string; label: string; count: number }[];
  byType: { type: string; count: number }[];
  byDirection: { direction: "INBOUND" | "OUTBOUND"; count: number }[];
  byUser: { userId: string; user: { id: string; firstName: string | null; lastName: string | null } | null; count: number }[];
  conversion: { triggeringCount: number; rate: number };
}

export interface ClientsReportDTO {
  total: number;
  byDossierStatus: { statusId: string; label: string; count: number }[];
  byFinalStatus: { statusId: string; label: string; count: number }[];
}

export interface AppointmentsReportDTO {
  total: number;
  byStatus: { status: string; count: number }[];
  /** RDV confirmés et terminés uniquement (voir countAttendance côté backend). */
  attendance: { honored: number; missed: number; unmarked: number };
}

export interface ReportsRangeQuery {
  from: Date;
  to: Date;
  /** Ignoré côté serveur si l'appelant n'a pas reports.viewAll — voir modules/reports/service.ts. */
  userId?: string;
}

function rangeQuery(query: ReportsRangeQuery) {
  return buildQuery({ from: query.from.toISOString(), to: query.to.toISOString(), userId: query.userId });
}

export function getCallsReport(query: ReportsRangeQuery, accessToken: string) {
  return apiClient.get<CallsReportDTO>(`/reports/calls${rangeQuery(query)}`, accessToken);
}

export function getClientsReport(query: ReportsRangeQuery, accessToken: string) {
  return apiClient.get<ClientsReportDTO>(`/reports/clients${rangeQuery(query)}`, accessToken);
}

export function getAppointmentsReport(query: ReportsRangeQuery, accessToken: string) {
  return apiClient.get<AppointmentsReportDTO>(`/reports/appointments${rangeQuery(query)}`, accessToken);
}

export interface SignedContractsDTO {
  count: number;
}

/** GET /reports/signed-contracts — §5.27, mois calendaire en cours, pas une période libre. */
export function getSignedContractsCount(userId: string | undefined, accessToken: string) {
  return apiClient.get<SignedContractsDTO>(`/reports/signed-contracts${buildQuery({ userId })}`, accessToken);
}

export interface AppointmentsHistoryPeriodDTO {
  from: string;
  to: string;
  totalAppointments: number;
  confirmedCount: number;
  refusedCount: number;
  honoredCount: number;
  missedCount: number;
  unmarkedCount: number;
  signedContracts: number;
  conversionRate: number;
}

export interface AppointmentsHistoryDTO {
  granularity: "week" | "month";
  periods: AppointmentsHistoryPeriodDTO[];
}

export interface AppointmentsHistoryQuery {
  granularity: "week" | "month";
  periods?: number;
  userId?: string;
}

/** GET /reports/appointments-history — §5.28, fenêtres glissantes de 7/30 jours. */
export function getAppointmentsHistory(query: AppointmentsHistoryQuery, accessToken: string) {
  return apiClient.get<AppointmentsHistoryDTO>(
    `/reports/appointments-history${buildQuery(query as unknown as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}
