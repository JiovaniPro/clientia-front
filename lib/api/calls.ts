import { ApiError, apiClient, buildQuery } from "@/lib/api/client";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";

export type CallDirection = "INBOUND" | "OUTBOUND";
export type CallType = "PROSPECTION" | "SUPPORT" | "FOLLOW_UP" | "OTHER";

export interface CallDTO {
  id: string;
  userId: string;
  direction: CallDirection;
  type: CallType;
  statusId: string;
  status: ConfigurableListItemDTO;
  waveNumber: number | null;
  fromNumber: string;
  toNumber: string;
  durationSec: number | null;
  notes: string | null;
  occurredAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  recallDate: string | null;
  recallTimeSlot: string | null;
  /** §5.4 — dernier changement de statut effectif (source de vérité de "traité aujourd'hui"). */
  lastStatusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  /** §5.4 — présent uniquement dans les items de GET /calls (listCalls), pas dans les autres réponses. */
  hasActiveReminder?: boolean;
  /** Ajouté au lot 3 pour le §P0.2 : présence d'un dossier sans requête supplémentaire par ligne. */
  client: { id: string } | null;
  /** §5.18 — nom de l'agent, résolu côté backend (colonne "Agent" du Journal). */
  user: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface ListCallsResponse {
  items: CallDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListCallsFilters {
  statusKey?: string;
  /** §5.4 — multi-statut (union), liste séparée par virgules ; le backend accepte aussi un tableau. Écran "Aujourd'hui" uniquement. */
  statusKeys?: string;
  /** §P0.2/§5.6 : exclut un statut au lieu de filtrer dessus — voir modules/calls/service.ts. */
  excludeStatusKey?: string;
  type?: CallType;
  waveNumber?: number;
  from?: string;
  to?: string;
  /** §5.4 — mêmes bornes que from/to mais sur lastStatusChangedAt (écran "Aujourd'hui"). */
  changedFrom?: string;
  changedTo?: string;
  search?: string;
  /** §5.18 — ignoré côté backend sans calls.viewAll, voir modules/calls/service.ts. */
  userId?: string;
  /** "queue" = vague → nom → prénom (§P0.2, "À appeler") ; "recent" (défaut) = plus récent d'abord (Journal). */
  sort?: "recent" | "queue" | "changed";
  page?: number;
  pageSize?: number;
}

export function listCalls(filters: ListCallsFilters, accessToken: string) {
  // Cast honnête : tous les champs de ListCallsFilters sont bien string|number|boolean|undefined,
  // seule l'absence de signature d'index empêche l'affectation structurelle directe (limite connue de TS).
  return apiClient.get<ListCallsResponse>(
    `/calls${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export interface CreateCallInput {
  direction: CallDirection;
  type: CallType;
  statusKey: string;
  fromNumber: string;
  toNumber: string;
  durationSec?: number;
  notes?: string;
  occurredAt: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  recallDate?: string;
  recallTimeSlot?: string;
}

export interface CreateCallResponse {
  call: CallDTO;
  triggersClientDossierCreation: boolean;
}

export function createCall(input: CreateCallInput, accessToken: string) {
  return apiClient.post<CreateCallResponse>("/calls", input, accessToken);
}

export interface ChangeCallStatusInput {
  statusKey: string;
  recallDate?: string;
  recallTimeSlot?: string;
}

export interface ChangeCallStatusResponse {
  call: CallDTO;
  triggersClientDossierCreation: boolean;
}

/** Le code d'erreur CLIENT_DOSSIER_REQUIRED (§P0.2) arrive dans ApiError.details.code — voir calls/service.ts côté backend. */
export const CLIENT_DOSSIER_REQUIRED_CODE = "CLIENT_DOSSIER_REQUIRED";

export function changeCallStatus(id: string, input: ChangeCallStatusInput, accessToken: string) {
  return apiClient.patch<ChangeCallStatusResponse>(`/calls/${id}/status`, input, accessToken);
}

export interface CallStatusHistoryEntryDTO {
  id: string;
  oldStatus: ConfigurableListItemDTO | null;
  newStatus: ConfigurableListItemDTO;
  changedAt: string;
  changedBy: { id: string; firstName: string | null; lastName: string | null };
}

export interface CallDetailDTO extends CallDTO {
  client: { id: string } | null;
  statusHistory: CallStatusHistoryEntryDTO[];
}

/** 204 en cas de succès ; 409 (details.code = CALL_HAS_CLIENT_DOSSIER) si un dossier client est lié — le message backend est destiné à être affiché tel quel. */
export function deleteCall(id: string, accessToken: string) {
  return apiClient.delete<void>(`/calls/${id}`, accessToken);
}

/** §5.6 — vue détail/historique pour le journal des appels. */
export function getCall(id: string, accessToken: string) {
  return apiClient.get<CallDetailDTO>(`/calls/${id}`, accessToken);
}

export interface ImportCallsResponse {
  waveNumber: number;
  count: number;
}

export async function importCalls(file: File, accessToken: string): Promise<ImportCallsResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/calls/import`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? res.statusText, data?.details);
  }
  return data as ImportCallsResponse;
}

/** Réattribution par un admin (calls.viewAll) : propriétaire changé, vague remise à null, rappels liés suivis. */
export function reassignCall(id: string, userId: string, accessToken: string) {
  return apiClient.patch<{ count: number; userId: string }>(`/calls/${id}/owner`, { userId }, accessToken);
}

export function reassignCalls(callIds: string[], userId: string, accessToken: string) {
  return apiClient.patch<{ count: number; userId: string }>("/calls/owner", { callIds, userId }, accessToken);
}

/**
 * Le formulaire demande une date de rappel pour les statuts à date de rappel, SAUF "Ne répond pas" : son rappel
 * automatique se calcule seul (+7 jours) — miroir de backend modules/calls/autoReminder.ts::asksForRecallDate.
 */
export function asksForRecallDate(status: { key: string; metadata?: Record<string, unknown> | null } | undefined) {
  return Boolean(status?.metadata?.requiresRecallDate) && status?.key !== "NE_REPOND_PAS";
}
