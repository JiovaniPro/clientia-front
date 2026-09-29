import { apiClient } from "@/lib/api/client";
import type { AuthUser } from "@/lib/auth/AuthContext";

/** Public — consommé par la page /reset-password, sans jeton d'accès (l'utilisateur n'est pas connecté). */
export function confirmPasswordReset(token: string, newPassword: string) {
  return apiClient.post<void>("/auth/reset-password/confirm", { token, newPassword });
}

/**
 * Public — POST /auth/forgot-password. Le backend répond TOUJOURS 202 avec un message fixe, que le compte
 * existe ou non : la réponse n'est volontairement PAS retournée (l'écran ne doit jamais l'interpréter).
 */
export async function requestPasswordResetLink(input: { organizationSlug: string; email: string }): Promise<void> {
  await apiClient.post<unknown>("/auth/forgot-password", input);
}

export interface UpdateMeInput {
  email?: string;
  firstName?: string;
  lastName?: string;
}

/** PATCH /auth/me — §5.11 sous-lot 1, retourne la même forme que GET /auth/me. */
export function updateMe(input: UpdateMeInput, accessToken: string) {
  return apiClient.patch<{ user: AuthUser }>("/auth/me", input, accessToken);
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** POST /auth/change-password — §5.11 sous-lot 2, laisse la session courante valide. */
export function changePassword(input: ChangePasswordInput, accessToken: string) {
  return apiClient.post<void>("/auth/change-password", input, accessToken);
}
