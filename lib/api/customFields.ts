import { apiClient } from "@/lib/api/client";

export type CustomFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTISELECT"
  | "CHECKBOX"
  | "EMAIL"
  | "PHONE";

export interface CustomFieldDefinitionDTO {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  isRequired: boolean;
  order: number;
  section: string | null;
  isActive: boolean;
}

/** Seul "CLIENT" est pris en charge en V1 côté backend (voir SUPPORTED_ENTITY_TYPES,
 * modules/customFields/service.ts) — pas de sélecteur de type d'entité côté écran. */
export const SUPPORTED_ENTITY_TYPE = "CLIENT";

export function listDefinitions(entityType: string, accessToken: string, includeInactive = false) {
  const query = `entityType=${encodeURIComponent(entityType)}${includeInactive ? "&includeInactive=true" : ""}`;
  return apiClient.get<CustomFieldDefinitionDTO[]>(`/custom-fields/definitions?${query}`, accessToken);
}

export interface CreateCustomFieldDefinitionInput {
  entityType: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  isRequired?: boolean;
  order?: number;
  section?: string;
}
export function createDefinition(input: CreateCustomFieldDefinitionInput, accessToken: string) {
  return apiClient.post<CustomFieldDefinitionDTO>("/custom-fields/definitions", input, accessToken);
}

/** `key`, `entityType` et `fieldType` sont immuables après création (absents du
 * schéma backend `updateCustomFieldDefinitionSchema`) — changer le type d'un champ
 * déjà rempli sur des dossiers clients transformerait des valeurs existantes en
 * données incohérentes (ex. une réponse SELECT face à un champ redevenu TEXT). */
export interface UpdateCustomFieldDefinitionInput {
  label?: string;
  options?: string[];
  isRequired?: boolean;
  order?: number;
  section?: string;
  isActive?: boolean;
}
export function updateDefinition(id: string, input: UpdateCustomFieldDefinitionInput, accessToken: string) {
  return apiClient.patch<CustomFieldDefinitionDTO>(`/custom-fields/definitions/${id}`, input, accessToken);
}
