import { apiClient } from "@/lib/api/client";

export interface ConfigurableListItemDTO {
  id: string;
  listKey: string;
  key: string;
  label: string;
  color: string | null;
  order: number;
  isActive: boolean;
  isDefault: boolean;
  metadata: Record<string, boolean> | null;
}

/** GET /configurable-lists/:listKey — jamais de statut/couleur codé en dur côté front. */
export function getConfigurableList(listKey: string, accessToken: string) {
  return apiClient.get<ConfigurableListItemDTO[]>(`/configurable-lists/${listKey}`, accessToken);
}

/** Écran d'administration §5.22 — toutes les listes groupées par clé, en un seul appel. */
export function listAllConfigurableLists(accessToken: string) {
  return apiClient.get<Record<string, ConfigurableListItemDTO[]>>("/configurable-lists", accessToken);
}

export interface UpdateListItemInput {
  label?: string;
  color?: string;
  order?: number;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, boolean>;
}
export function updateListItem(id: string, input: UpdateListItemInput, accessToken: string) {
  return apiClient.patch<ConfigurableListItemDTO>(`/configurable-lists/items/${id}`, input, accessToken);
}

export function deleteListItem(id: string, accessToken: string) {
  return apiClient.delete<void>(`/configurable-lists/items/${id}`, accessToken);
}

export interface CreateListItemInput {
  listKey: string;
  key: string;
  label: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
  metadata?: Record<string, boolean>;
}
export function createListItem(input: CreateListItemInput, accessToken: string) {
  return apiClient.post<ConfigurableListItemDTO>("/configurable-lists", input, accessToken);
}

export interface BehaviorFlagDTO {
  key: string;
  label: string;
}

/**
 * Catalogue des drapeaux comportementaux connus, groupés par `listKey` — jamais de
 * clé de comportement tapée librement côté écran (voir configurableListsCatalog.ts
 * côté backend, qui est la source de vérité et rejette toute clé absente d'ici).
 */
export function getBehaviorFlagsCatalog(accessToken: string) {
  return apiClient.get<Record<string, BehaviorFlagDTO[]>>("/configurable-lists/behavior-flags-catalog", accessToken);
}
