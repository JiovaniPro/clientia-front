import { apiClient } from "@/lib/api/client";

export interface PlatformAdminDTO {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
}

export interface PlatformAuthPayload {
  accessToken: string;
  platformAdmin: PlatformAdminDTO;
}

export interface PlatformLoginInput {
  email: string;
  password: string;
}

/** Tout ceci cible /platform/auth/*, jamais /auth/* — cookies, secrets JWT et
 * contexte React (PlatformAuthContext) entièrement séparés du côté organisation. */
export function platformLogin(input: PlatformLoginInput) {
  return apiClient.post<PlatformAuthPayload>("/platform/auth/login", input);
}

export function platformRefresh() {
  return apiClient.post<PlatformAuthPayload>("/platform/auth/refresh");
}

export function platformLogout() {
  return apiClient.post<void>("/platform/auth/logout");
}

export function platformMe(accessToken: string) {
  return apiClient.get<{ platformAdmin: PlatformAdminDTO }>("/platform/auth/me", accessToken);
}

export interface ChangePlatformPasswordInput {
  currentPassword: string;
  newPassword: string;
}
export function changePlatformPassword(input: ChangePlatformPasswordInput, accessToken: string) {
  return apiClient.post<void>("/platform/auth/change-password", input, accessToken);
}

export interface UpdatePlatformProfileInput {
  email?: string;
  name?: string;
}
/** Pas de `PATCH /platform/auth/me` : on réutilise `PATCH /platform/admins/:id`
 * (tout Super Admin peut déjà modifier n'importe quel Super Admin, soi compris). */
export function updatePlatformProfile(id: string, input: UpdatePlatformProfileInput, accessToken: string) {
  return apiClient.patch<PlatformAdminDTO>(`/platform/admins/${id}`, input, accessToken);
}
