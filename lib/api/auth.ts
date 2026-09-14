import { apiClient } from "@/lib/api/client";

/** Public — consommé par la page /reset-password, sans jeton d'accès (l'utilisateur n'est pas connecté). */
export function confirmPasswordReset(token: string, newPassword: string) {
  return apiClient.post<void>("/auth/reset-password/confirm", { token, newPassword });
}
