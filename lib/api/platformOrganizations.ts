import { apiClient } from "@/lib/api/client";

export interface PlatformOrganizationSummaryDTO {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** Renseigné = supprimée (suppression douce) — lecture seule, absente de la liste active. */
  deletedAt: string | null;
  createdAt: string;
  _count: { users: number };
}

export interface PlatformOrganizationUserDTO {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  role: { name: string };
}

export interface PlatformOrganizationDetailDTO extends PlatformOrganizationSummaryDTO {
  users: PlatformOrganizationUserDTO[];
}

/** Toutes ces requêtes exigent un accessToken PLATEFORME (voir PlatformAuthContext),
 * jamais celui d'un utilisateur d'organisation — cible /platform/organizations. */
export function listOrganizations(accessToken: string) {
  return apiClient.get<PlatformOrganizationSummaryDTO[]>("/platform/organizations", accessToken);
}

export function getOrganization(id: string, accessToken: string) {
  return apiClient.get<PlatformOrganizationDetailDTO>(`/platform/organizations/${id}`, accessToken);
}

export interface CreatePlatformOrganizationInput {
  organizationName: string;
  organizationSlug: string;
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
}
export function createOrganization(input: CreatePlatformOrganizationInput, accessToken: string) {
  return apiClient.post<PlatformOrganizationDetailDTO>("/platform/organizations", input, accessToken);
}

/**
 * §5.29 sous-lot 6 — suspendre coupe l'accès immédiatement (message explicite au
 * prochain appel API, sessions actives révoquées) et réactiver restaure l'accès
 * sans rien reconstruire (voir modules/platform/organizations/service.ts). Pas de
 * garde-fou "dernier"/"soi-même" ici — contrairement aux Super Admins ou aux
 * utilisateurs, il n'existe pas de notion de "organisation qui s'auto-suspend".
 */
export function setOrganizationStatus(id: string, isActive: boolean, accessToken: string) {
  return apiClient.patch<PlatformOrganizationDetailDTO>(`/platform/organizations/${id}/status`, { isActive }, accessToken);
}

/** Organisations supprimées (suppression douce) — consultation seule. */
export function listDeletedOrganizations(accessToken: string) {
  return apiClient.get<PlatformOrganizationSummaryDTO[]>("/platform/organizations/deleted", accessToken);
}

/** Exige une organisation suspendue ; `confirmName` est revérifié côté serveur (nom exact). */
export function deleteOrganization(id: string, confirmName: string, accessToken: string) {
  return apiClient.delete<PlatformOrganizationDetailDTO>(`/platform/organizations/${id}`, accessToken, { confirmName });
}
