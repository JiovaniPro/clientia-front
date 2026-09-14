import { apiClient } from "@/lib/api/client";

export interface RoleListItemDTO {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
}

export interface PermissionDTO {
  id: string;
  key: string;
  module: string;
  label: string;
  description: string | null;
}

export interface RoleDetailDTO extends RoleListItemDTO {
  permissions: { permission: PermissionDTO }[];
  _count: { users: number };
}

/**
 * Lecture minimale — juste ce qu'il faut pour peupler le sélecteur de rôle de
 * l'écran Utilisateurs.
 */
export function listRoles(accessToken: string) {
  return apiClient.get<RoleListItemDTO[]>("/roles", accessToken);
}

/** Écran d'administration §5.21 — liste complète avec permissions et nombre d'utilisateurs assignés. */
export function listRolesDetailed(accessToken: string) {
  return apiClient.get<RoleDetailDTO[]>("/roles", accessToken);
}

export function listPermissionsCatalog(accessToken: string) {
  return apiClient.get<PermissionDTO[]>("/roles/permissions-catalog", accessToken);
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  color?: string;
  permissionKeys: string[];
}
export function createRole(input: CreateRoleInput, accessToken: string) {
  return apiClient.post<RoleDetailDTO>("/roles", input, accessToken);
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  color?: string;
  permissionKeys?: string[];
}
export function updateRole(id: string, input: UpdateRoleInput, accessToken: string) {
  return apiClient.patch<RoleDetailDTO>(`/roles/${id}`, input, accessToken);
}

export function deleteRole(id: string, accessToken: string) {
  return apiClient.delete<void>(`/roles/${id}`, accessToken);
}
