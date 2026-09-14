import { apiClient } from "@/lib/api/client";

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
}

export function getCurrentOrganization(accessToken: string) {
  return apiClient.get<OrganizationDTO>("/organizations/me", accessToken);
}

export interface UpdateOrganizationInput {
  name?: string;
  /** `null` efface explicitement le logo, `undefined` (champ omis) le laisse inchangé. */
  logoUrl?: string | null;
  primaryColor?: string;
}
export function updateCurrentOrganization(input: UpdateOrganizationInput, accessToken: string) {
  return apiClient.patch<OrganizationDTO>("/organizations/me", input, accessToken);
}
