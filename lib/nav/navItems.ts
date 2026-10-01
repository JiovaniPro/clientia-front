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
  { href: "/today", label: "Aujourd'hui", paletteLabel: "Aller à l'accueil", icon: Home },
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
    label: "E-mails",
    paletteLabel: "Aller aux modèles et à l'historique des e-mails",
    icon: Mail,
    // OR : la page elle-même n'affiche que l'onglet couvert par la permission de
    // l'appelant (voir app/(app)/admin/emails/page.tsx) — un Agent calliste/RDV
    // sans emails.manageTemplates y a quand même sa place via emails.viewHistory.
    permission: ["emails.manageTemplates", "emails.viewHistory"],
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

/**
 * §5.25-§5.28 — nav dédiée et EXCLUSIVE pour l'Agent RDV (remplace la nav
 * générique, décision actée avec l'utilisateur : pas les deux à la fois). Les 4
 * écrans du brief + e-mails/notifications/mon compte, déjà tous construits —
 * aucun composant neuf ici, uniquement un jeu d'entrées de nav différent.
 */
export const AGENT_RDV_NAV_ITEMS: NavItem[] = [
  {
    href: "/agent-rdv/dashboard",
    label: "Tableau de bord",
    paletteLabel: "Aller au tableau de bord",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    href: "/agent-rdv/dashboard/details",
    label: "Détail du suivi",
    paletteLabel: "Aller au détail du suivi",
    icon: LineChart,
    permission: "reports.view",
  },
  {
    href: "/agent-rdv/clients",
    label: "Mes clients",
    paletteLabel: "Aller à mes clients",
    icon: Users,
    permission: "clients.view",
  },
  {
    href: "/agent-rdv/calendar",
    label: "Mon calendrier",
    paletteLabel: "Aller à mon calendrier",
    icon: CalendarDays,
    permission: "calendar.view",
  },
  {
    href: "/admin/emails",
    label: "E-mails",
    paletteLabel: "Aller aux e-mails",
    icon: Mail,
    permission: ["emails.manageTemplates", "emails.viewHistory"],
  },
  {
    href: "/notifications",
    label: "Notifications",
    paletteLabel: "Aller à mes notifications",
    icon: Bell,
    permission: "notifications.view",
  },
  // "Mon compte" n'est PAS répété ici : le lien fixe en bas du rail (SideRail.tsx,
  // §5.11) est déjà présent pour tous les rôles, y compris avec cette nav swappée.
];

/**
 * Signal de capacité, jamais un nom de rôle en dur (§P0.0) : `calendar.manageAppointments`
 * n'existe par défaut que sur le rôle "Agent RDV" (voir lib/defaultRoles.ts côté
 * backend) — un rôle renommé ou un second rôle équivalent bascule aussi sur cette
 * nav. Exclu explicitement si l'appelant a en plus un droit d'administration
 * cross-utilisateurs (`clients.viewAll`/`users.view`) : l'Administrateur système a
 * TOUTES les permissions, y compris `calendar.manageAppointments`, et doit
 * continuer à voir la nav complète, pas la nav simplifiée.
 */
export function isAgentRdvNavProfile(hasPermission: (key: string) => boolean): boolean {
  return (
    hasPermission("calendar.manageAppointments") &&
    !hasPermission("clients.viewAll") &&
    !hasPermission("users.view")
  );
}
