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
  createdAt: string;
  updatedAt: string;
  /** Ajouté au lot 3 pour le §P0.2 : présence d'un dossier sans requête supplémentaire par ligne. */
  client: { id: string } | null;
}

export interface ListCallsResponse {
  items: CallDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListCallsFilters {
  statusKey?: string;
  /** §P0.2/§5.6 : exclut un statut au lieu de filtrer dessus — voir modules/calls/service.ts. */
  excludeStatusKey?: string;
  type?: CallType;
  waveNumber?: number;
  from?: string;
  to?: string;
  search?: string;
  /** "queue" = vague → nom → prénom (§P0.2, "À appeler") ; "recent" (défaut) = plus récent d'abord (Journal). */
  sort?: "recent" | "queue";
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
