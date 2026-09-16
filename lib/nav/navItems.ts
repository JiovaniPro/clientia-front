import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  History,
  Home,
  KeyRound,
  LineChart,
  ListChecks,
  Mail,
  Phone,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";

/**
 * Source unique des destinations de navigation, consommée à la fois par `SideRail`
 * (rail latéral) et `CommandPalette` (Cmd+K) — avant le lot 4 les deux composants
 * dupliquaient cette liste indépendamment, avec le même gap dans les deux : un item
 * restait visible même sans la permission qui protège son endpoint (ex. "Journal"
 * visible pour un Agent RDV sans `calls.view`, qui obtenait un 403 propre au clic
 * plutôt qu'un lien simplement absent). `permission` déclare la ou les clés requises
 * pour VOIR l'item (sémantique OR sur un tableau, comme `requireAnyPermission` côté
 * backend) ; omis = accessible à tout utilisateur connecté. Grandira avec chaque lot.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Phrase affichée dans la palette de commandes (Cmd+K) pour cette destination. */
  paletteLabel: string;
  icon: LucideIcon;
  permission?: string | string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Aujourd'hui", paletteLabel: "Aller à l'accueil", icon: Home },
  { href: "/calls", label: "Appels", paletteLabel: "Aller à la file d'appels", icon: Phone, permission: "calls.view" },
  {
    href: "/history",
    label: "Journal",
    paletteLabel: "Aller au journal des appels",
    icon: History,
    permission: "calls.view",
  },
  {
    href: "/clients",
    label: "Dossiers",
    paletteLabel: "Aller à mes dossiers clients",
    icon: Users,
    permission: "clients.view",
  },
  {
    href: "/calendar-pro",
    label: "Calendrier",
    paletteLabel: "Aller au calendrier",
    icon: CalendarDays,
    permission: "calendar.view",
  },
  {
    href: "/reminders",
    label: "Rappels",
    paletteLabel: "Aller à mes rappels",
    icon: AlarmClock,
    permission: "reminders.view",
  },
  {
    href: "/notifications",
    label: "Notifications",
    paletteLabel: "Aller à mes notifications",
    icon: Bell,
    permission: "notifications.view",
  },
  {
    href: "/my-stats",
    label: "Mes statistiques",
    paletteLabel: "Aller à mes statistiques",
    icon: LineChart,
    // §5.17 — accès à ses propres stats (Agent calliste/RDV inclus) ; le sélecteur
    // d'agent dans l'écran lui-même n'apparaît qu'avec reports.viewAll en plus.
    permission: "reports.view",
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    paletteLabel: "Aller à l'administration des utilisateurs",
    icon: Shield,
    /**
     * Volontairement `users.view` seul — pas le OR `["clients.view", "users.view"]`
     * de l'endpoint `GET /users` (qui sert aussi l'annuaire léger des sélecteurs).
     * Sinon un Agent calliste/RDV (qui a `clients.view` mais jamais `users.view` par
     * défaut) verrait apparaître une entrée d'administration à laquelle il n'a en
     * réalité aucun accès d'écriture.
     */
    permission: "users.view",
  },
  {
    href: "/admin/roles",
    label: "Rôles & permissions",
    paletteLabel: "Aller à l'administration des rôles et permissions",
    icon: KeyRound,
    permission: "roles.manage",
  },
  {
    href: "/admin/configurable-lists",
    label: "Listes configurables",
    paletteLabel: "Aller à l'administration des listes configurables",
    icon: ListChecks,
    permission: "configurableLists.manage",
  },
  {
    href: "/admin/custom-fields",
    label: "Champs personnalisés",
    paletteLabel: "Aller à l'administration des champs personnalisés",
    icon: SlidersHorizontal,
    permission: "customFields.manage",
  },
  {
    href: "/admin/emails",
    label: "Modèles d'e-mail",
    paletteLabel: "Aller à l'administration des modèles d'e-mail",
    icon: Mail,
    permission: "emails.manageTemplates",
  },
  {
    href: "/admin/organization",
    label: "Organisation",
    paletteLabel: "Aller aux paramètres de l'organisation",
    icon: Building2,
    permission: "organization.manageSettings",
  },
  {
    href: "/admin/dashboard",
    label: "Tableau de bord",
    paletteLabel: "Aller au tableau de bord",
    icon: BarChart3,
    // §5.15 — vue globale de l'organisation, réservée à reports.viewAll. La vue
    // individuelle ("mes statistiques", §5.17) est un écran séparé sur reports.view.
    permission: "reports.viewAll",
  },
];

export function isNavItemVisible(
  permission: string | string[] | undefined,
  hasPermission: (key: string) => boolean,
): boolean {
  if (!permission) return true;
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some(hasPermission);
}
