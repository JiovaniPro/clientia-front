import { redirect } from "next/navigation";

/**
 * §5.28 "Mon calendrier" — sous-lot 1. Alias, pas un écran séparé : vérifié que
 * `/calendar-pro` se comporte déjà exactement comme demandé pour un Agent RDV
 * (sans `calendar.viewAll`, ni le sélecteur multi-agent ni les données d'un autre
 * agent n'apparaissent — filtrage structurel côté backend, voir
 * modules/calendar/service.ts::eventAccessFilter). Construire un second écran
 * dupliquerait un calendrier déjà correct plutôt que d'ajouter la moindre valeur.
 */
export default function AgentRdvCalendarPage() {
  redirect("/calendar-pro");
}
