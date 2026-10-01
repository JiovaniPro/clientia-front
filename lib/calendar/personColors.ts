/**
 * Vue calendrier partagée — une couleur pastel par personne, unique et stable.
 *
 * Stable : la couleur dépend du rang d'ancienneté du compte (createdAt, puis id) parmi
 * TOUS les utilisateurs de l'organisation, actifs ou non. Un compte n'est jamais supprimé
 * physiquement (§2.2) et createdAt ne change pas : un nouvel arrivant prend le rang
 * suivant sans décaler personne, une désactivation ou un changement de rôle non plus.
 * Unique : les 12 premiers rangs prennent la palette ; au-delà, teinte procédurale par
 * angle d'or (137,5°), qui ne retombe jamais exactement sur une teinte déjà donnée.
 */
export const PASTEL_PALETTE = [
  "#F4B6B6", // rose
  "#A6D3EE", // ciel
  "#C8E6A0", // vert tendre
  "#F9D29D", // abricot
  "#D4B8F0", // lavande
  "#A8DCC8", // menthe
  "#F6EBA0", // jaune
  "#B8C2F2", // pervenche
  "#F2B8DE", // rose bonbon
  "#B5E3E8", // aqua
  "#E3C4A8", // pêche
  "#D9D2A9", // sable
];

/** Texte sombre fixe : lisible sur tout pastel, en thème clair comme sombre. */
export const PASTEL_TEXT_COLOR = "#1F2A24";

export function pastelForRank(rank: number): string {
  if (rank < PASTEL_PALETTE.length) return PASTEL_PALETTE[rank]!;
  const hue = (20 + (rank - PASTEL_PALETTE.length) * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 62% 80%)`;
}

export function buildPersonColors(users: { id: string; createdAt: string }[]): Map<string, string> {
  const ranked = [...users].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(ranked.map((u, rank) => [u.id, pastelForRank(rank)]));
}
