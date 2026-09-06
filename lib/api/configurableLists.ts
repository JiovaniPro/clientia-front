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
