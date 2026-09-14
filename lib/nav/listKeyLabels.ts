/**
 * Libellés d'affichage des 8 listes configurables (§5.22) — le backend ne renvoie
 * que les clés brutes (ex. "CALL_STATUS"), aucun catalogue de libellés n'existe côté
 * serveur pour ces clés (contrairement aux permissions, voir permissionsCatalog.ts).
 * Purement cosmétique, décision frontend : une clé absente de cette table s'affiche
 * telle quelle plutôt que de faire échouer l'écran.
 */
export const LIST_KEY_LABELS: Record<string, string> = {
  CALL_STATUS: "Statuts d'appel",
  CLIENT_DOSSIER_STATUS: "Statuts de dossier",
  CLIENT_FINAL_STATUS: "Statuts finaux",
  CLIENT_COUNTRY: "Pays",
  CLIENT_CIVILITE: "Civilité",
  CLIENT_MARITAL_STATUS: "Statut marital",
  CLIENT_CHILDREN: "Enfants",
  CLIENT_TYPE_RDV: "Type de rendez-vous",
};

export function listKeyLabel(listKey: string): string {
  return LIST_KEY_LABELS[listKey] ?? listKey;
}
