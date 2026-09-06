import { apiClient, buildQuery } from "@/lib/api/client";

export interface UserListItemDTO {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  isActive: boolean;
  role: { id: string; name: string };
}

export interface ListUsersFilters {
  role?: string;
  isActive?: boolean;
  /** Recherche libre nom/email — §C2, sélecteur de participant interne. */
  search?: string;
}

/**
 * Endpoint minimal (lot avant le 5) : liste seule, pas de CRUD. Débloque le
 * sélecteur d'agent par nom (CreateClientDossierModal, filtre agentId de /clients) —
 * pas encore un écran de gestion des utilisateurs.
 */
export function listUsers(filters: ListUsersFilters, accessToken: string) {
  return apiClient.get<UserListItemDTO[]>(
    `/users${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}
