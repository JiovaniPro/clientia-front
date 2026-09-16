import { apiClient, buildQuery } from "@/lib/api/client";

export interface EmailTemplateDTO {
  id: string;
  key: string;
  label: string;
  subject: string;
  body: string;
  defaultAttachmentPath: string | null;
  isActive: boolean;
  isSystem: boolean;
}

export function listTemplates(accessToken: string) {
  return apiClient.get<EmailTemplateDTO[]>("/emails/templates", accessToken);
}

export interface CreateEmailTemplateInput {
  key: string;
  label: string;
  subject: string;
  body: string;
  defaultAttachmentPath?: string;
}
export function createTemplate(input: CreateEmailTemplateInput, accessToken: string) {
  return apiClient.post<EmailTemplateDTO>("/emails/templates", input, accessToken);
}

export interface UpdateEmailTemplateInput {
  label?: string;
  subject?: string;
  body?: string;
  defaultAttachmentPath?: string;
  isActive?: boolean;
}
export function updateTemplate(id: string, input: UpdateEmailTemplateInput, accessToken: string) {
  return apiClient.patch<EmailTemplateDTO>(`/emails/templates/${id}`, input, accessToken);
}

/**
 * Suppression physique — bloquée côté backend (contrainte de clé étrangère
 * Postgres, P2003 traduit en erreur métier) si le modèle a déjà servi à un envoi
 * réel (EmailHistory.emailTemplateId). Message backend affiché tel quel, jamais
 * re-deviné ici — voir §5.12 sous-lot 1.
 */
export function deleteTemplate(id: string, accessToken: string) {
  return apiClient.delete<void>(`/emails/templates/${id}`, accessToken);
}

export type EmailStatus = "PENDING" | "SENT" | "FAILED";

export interface EmailHistoryDTO {
  id: string;
  clientId: string;
  client: { id: string; firstName: string | null; lastName: string | null };
  appointmentEventId: string | null;
  emailTemplateId: string;
  templateKeySnapshot: string;
  subject: string;
  body: string;
  recipientEmail: string;
  sentAt: string | null;
  agentCallisteId: string;
  agentCalliste: { id: string; firstName: string | null; lastName: string | null };
  status: EmailStatus;
  errorMessage: string | null;
  isAutomated: boolean;
  createdAt: string;
}

export interface ListEmailHistoryResponse {
  items: EmailHistoryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListEmailHistoryFilters {
  clientId?: string;
  status?: EmailStatus;
  templateKey?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** GET /emails/history — §5.12 sous-lot 3, onglet Historique (lecture seule, filtrable). */
export function listHistory(filters: ListEmailHistoryFilters, accessToken: string) {
  return apiClient.get<ListEmailHistoryResponse>(
    `/emails/history${buildQuery(filters as Record<string, string | number | boolean | undefined>)}`,
    accessToken,
  );
}

export interface SendEmailInput {
  clientId: string;
  templateKey: string;
  appointmentEventId?: string;
  variables?: Record<string, string>;
}

export interface EmailPreviewDTO {
  templateLabel: string;
  subject: string;
  body: string;
}

/** POST /emails/preview — §5.12 sous-lot 4, aperçu avant envoi. Aucune écriture. */
export function previewEmail(input: SendEmailInput, accessToken: string) {
  return apiClient.post<EmailPreviewDTO>("/emails/preview", input, accessToken);
}

/** POST /emails/send — envoi réel, écrit dans EmailHistory (§5.12 sous-lot 1-4). */
export function sendEmail(input: SendEmailInput, accessToken: string) {
  return apiClient.post<EmailHistoryDTO>("/emails/send", input, accessToken);
}
