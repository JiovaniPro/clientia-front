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
 * Sert à la fois l'annuaire léger (sélecteur d'agent par nom, filtre agentId de
 * /clients — gate `clients.view` OU `users.view` côté backend) et l'écran
 * d'administration des utilisateurs (sous-lot Utilisateurs).
 */
export function listUsers(filters: ListUsersFilters, accessToken: string) {
  return apiClient.get<UserListItemDTO[]>(
    `/users${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export interface CreateUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  roleId: string;
}

/**
 * Ne renvoie jamais de mot de passe — il n'y en a pas de connu à renvoyer (§2.2) :
 * le compte créé est inutilisable jusqu'à ce que le lien envoyé par e-mail soit
 * ouvert (voir le lien "Réinitialiser le mot de passe" qui utilise le même
 * mécanisme, et resetPassword ci-dessous).
 */
export function createUser(input: CreateUserInput, accessToken: string) {
  return apiClient.post<UserListItemDTO>("/users", input, accessToken);
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
}

export function updateUser(id: string, input: UpdateUserInput, accessToken: string) {
  return apiClient.patch<UserListItemDTO>(`/users/${id}`, input, accessToken);
}

/**
 * Les deux garde-fous (pas d'auto-désactivation, jamais le dernier compte capable
 * de gérer les utilisateurs) sont vérifiés côté backend uniquement — cet appel
 * peut échouer avec un message clair, à afficher tel quel plutôt que deviné côté
 * client.
 */
export function setUserStatus(id: string, isActive: boolean, accessToken: string) {
  return apiClient.patch<UserListItemDTO>(`/users/${id}/status`, { isActive }, accessToken);
}

/** Déclenche l'envoi du lien à L'UTILISATEUR CIBLE — jamais un mot de passe visible ici. */
export function resetPassword(id: string, accessToken: string) {
  return apiClient.post<void>(`/users/${id}/reset-password`, {}, accessToken);
}
