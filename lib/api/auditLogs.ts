import { apiClient } from "@/lib/api/client";

export interface AuditLogDTO {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: string;
  /** null : auteur effacé (compte supprimé définitivement) ou action système. */
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

export interface ListAuditLogsFilters {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export function listAuditLogs(filters: ListAuditLogsFilters, accessToken: string) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
  );
  return apiClient.get<{ items: AuditLogDTO[]; total: number }>(`/audit-logs?${params}`, accessToken);
}

/** Libellés de l'enum backend `AuditAction` (prisma/schema.prisma) — une action absente s'affiche brute. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Connexion",
  LOGOUT: "Déconnexion",
  CALL_CREATED: "Appel créé",
  CALL_UPDATED: "Appel modifié",
  CALL_DELETED: "Appel supprimé",
  CALL_IMPORTED: "Appels importés",
  REMINDER_CREATED: "Rappel créé",
  REMINDER_UPDATED: "Rappel modifié",
  REMINDER_DELETED: "Rappel supprimé",
  SETTINGS_UPDATED: "Réglages modifiés",
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_ACTIVATED: "Utilisateur activé",
  USER_DEACTIVATED: "Utilisateur désactivé",
  USER_DELETED: "Utilisateur supprimé",
  USER_PURGED: "Utilisateur supprimé définitivement",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  CLIENT_CREATED: "Dossier créé",
  CLIENT_UPDATED: "Dossier modifié",
  CLIENT_DELETED: "Dossier supprimé",
  EVENT_CREATED: "Événement créé",
  EVENT_UPDATED: "Événement modifié",
  EVENT_DELETED: "Événement supprimé",
  APPOINTMENT_STATUS_CHANGED: "Statut de RDV changé",
  APPOINTMENT_ATTENDANCE_MARKED: "Présence au RDV marquée",
  ROLE_CREATED: "Rôle créé",
  ROLE_UPDATED: "Rôle modifié",
  ROLE_DELETED: "Rôle supprimé",
  CONFIGURABLE_LIST_ITEM_CREATED: "Élément de liste créé",
  CONFIGURABLE_LIST_ITEM_UPDATED: "Élément de liste modifié",
  CONFIGURABLE_LIST_ITEM_DELETED: "Élément de liste supprimé",
  CUSTOM_FIELD_CREATED: "Champ personnalisé créé",
  CUSTOM_FIELD_UPDATED: "Champ personnalisé modifié",
  CUSTOM_FIELD_DELETED: "Champ personnalisé supprimé",
  EMAIL_TEMPLATE_CREATED: "Modèle d'e-mail créé",
  EMAIL_TEMPLATE_UPDATED: "Modèle d'e-mail modifié",
  EMAIL_TEMPLATE_DELETED: "Modèle d'e-mail supprimé",
  EMAIL_SENT: "E-mail envoyé",
  ORGANIZATION_CREATED: "Organisation créée",
  ORGANIZATION_UPDATED: "Organisation modifiée",
  ORGANIZATION_DEACTIVATED: "Organisation désactivée",
  ORGANIZATION_ACTIVATED: "Organisation activée",
  ORGANIZATION_DELETED: "Organisation supprimée",
};
