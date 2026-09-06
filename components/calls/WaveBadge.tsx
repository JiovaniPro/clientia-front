import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Palette cyclique — purement visuelle (distinguer les vagues d'import d'un coup
 * d'œil), sans rapport avec les couleurs sémantiques de statut. Pas de valeur du
 * brief pour ce cas précis ; à ajuster si besoin.
 */
const WAVE_COLORS = ["#1f6f54", "#c9622b", "#3b6e91", "#8b5a9e", "#b98900", "#5b8f6b"];

export function WaveBadge({ waveNumber }: { waveNumber: number | null }) {
  if (waveNumber === null) return null;
  const color = WAVE_COLORS[waveNumber % WAVE_COLORS.length];
  return <StatusBadge label={`V-${waveNumber}`} color={color} variant="outline" />;
}
