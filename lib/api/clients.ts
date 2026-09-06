import { apiClient, buildQuery } from "@/lib/api/client";
import type { ConfigurableListItemDTO } from "@/lib/api/configurableLists";

type PersonRef = { id: string; firstName: string | null; lastName: string | null };

export interface ClientListItemDTO {
  id: string;
  callId: string;
  firstName: string | null;
  lastName: string | null;
  dossierStatusId: string;
  dossierStatus: ConfigurableListItemDTO;
  telephonisteId: string;
  telephoniste: PersonRef;
  agentId: string;
  agent: PersonRef;
  phoneNumber: string;
  email: string | null;
  countryId: string;
  country: ConfigurableListItemDTO;
  finalStatusId: string;
  finalStatus: ConfigurableListItemDTO;
  /** Déjà retiré côté backend si l'utilisateur n'a pas clients.viewAdminNote — voir stripAdminNote. */
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetailDTO extends ClientListItemDTO {
  civiliteId: string | null;
  civilite: ConfigurableListItemDTO | null;
  maritalStatusId: string | null;
  maritalStatus: ConfigurableListItemDTO | null;
  birthDate: string | null;
  childrenId: string | null;
  children: ConfigurableListItemDTO | null;
  typeRdvId: string | null;
  typeRdv: ConfigurableListItemDTO | null;
  adresse: string | null;
  comment: string | null;
  call: { id: string; toNumber: string; occurredAt: string; notes: string | null };
}

export interface ListClientsResponse {
  items: ClientListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListClientsFilters {
  dossierStatusKey?: string;
  finalStatusKey?: string;
  agentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** §5.7 — "Mes dossiers" : scopé automatiquement côté backend (télephoniste ou agent = moi), sauf clients.viewAll. */
export function listClients(filters: ListClientsFilters, accessToken: string) {
  return apiClient.get<ListClientsResponse>(
    `/clients${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

/** §5.8 — détail complet du dossier. */
export function getClient(id: string, accessToken: string) {
  return apiClient.get<ClientDetailDTO>(`/clients/${id}`, accessToken);
}

export interface CreateClientInput {
  callId: string;
  firstName?: string;
  lastName?: string;
  agentId: string;
  phoneNumber: string;
  countryKey: string;
  email?: string;
}

/** Étape de la cascade §P0.2 : créer le dossier avant de pouvoir rejouer le changement de statut. */
export function createClientDossier(input: CreateClientInput, accessToken: string) {
  return apiClient.post<ClientDetailDTO>("/clients", input, accessToken);
}

export interface UpdateClientInput {
  firstName?: string;
  lastName?: string;
  agentId?: string;
  phoneNumber?: string;
  email?: string;
  countryKey?: string;
  civiliteKey?: string;
  maritalStatusKey?: string;
  birthDate?: string;
  childrenKey?: string;
  typeRdvKey?: string;
  adresse?: string;
  comment?: string;
  dossierStatusKey?: string;
  /**
   * §P0.4 — le backend rejette (403) si l'utilisateur n'a pas clients.editFinalStatus,
   * ou n'est ni Admin (clients.viewAll) ni l'agent RDV assigné au dossier. Le front
   * masque le contrôle par confort (voir ClientDetailPage), mais la garantie réelle
   * est entièrement côté backend (modules/clients/service.ts::canEditFinalStatus).
   */
  finalStatusKey?: string;
  adminNote?: string;
}

export function updateClient(id: string, input: UpdateClientInput, accessToken: string) {
  return apiClient.patch<ClientDetailDTO>(`/clients/${id}`, input, accessToken);
}
