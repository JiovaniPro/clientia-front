"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthContext";
import { AGENT_RDV_NAV_ITEMS, isAgentRdvNavProfile, isNavItemVisible, NAV_ITEMS } from "@/lib/nav/navItems";
import type { NavItem } from "@/lib/nav/navItems";
import { Logo } from "@/components/brand/Logo";
import { OrganizationSwitcher } from "@/components/shell/OrganizationSwitcher";

const STORAGE_KEY = "clientia:rail-collapsed";

/**
 * Ouvre la palette de commandes (CommandPalette écoute Ctrl/Cmd+K sur window) : le bouton "Rechercher" du rail
 * rejoue ce raccourci plutôt que d'ajouter un état partagé entre deux composants du cadre.
 */
function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
}
export function SideRail() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // stockage indisponible — repli silencieux sur l'état déplié par défaut
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // idem
      }
      return next;
    });
  }

  const visibleNavItems = (isAgentRdvNavProfile(hasPermission) ? AGENT_RDV_NAV_ITEMS : NAV_ITEMS).filter(
    (item) => !item.hideInRail && isNavItemVisible(item.permission, hasPermission),
  );
  const activeHref = visibleNavItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  // Deux groupes : le travail quotidien (sans libellé), puis l'administration. Un groupe vide n'est pas rendu.
  const sections: { label: string | null; items: NavItem[] }[] = [
    { label: null, items: visibleNavItems.filter((item) => !item.section) },
    { label: "Administration", items: visibleNavItems.filter((item) => item.section === "admin") },
  ].filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-[width]",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border px-3", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? null : (
          <Link href="/" aria-label="CLIENTIA — accueil" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
            <Logo className="h-8" priority />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden /> : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-4" aria-label="Navigation principale">
        <OrganizationSwitcher collapsed={collapsed} />
        <button
          type="button"
          onClick={openCommandPalette}
          title={collapsed ? "Rechercher (Ctrl K)" : undefined}
          aria-label="Rechercher une page (Ctrl K)"
          className={cn(
            "mb-4 flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface-subtle/60 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {collapsed ? null : (
            <>
              <span className="flex-1 text-left">Rechercher…</span>
              <kbd className="rounded-sm border border-border bg-surface px-1.5 font-mono text-[11px] leading-5 text-ink-muted">
                Ctrl K
              </kbd>
            </>
          )}
        </button>

        {sections.map((section, index) => (
          <div key={section.label ?? "main"} className={index > 0 ? "mt-5" : undefined}>
            {section.label ? (
              collapsed ? (
                <div aria-hidden className="mx-3 mb-3 border-t border-border" />
              ) : (
                <p className="mb-1.5 px-3 text-xs font-medium text-ink-faint">{section.label}</p>
              )
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                // Le href le plus long (le plus spécifique) gagne quand plusieurs items
                // matchent — nécessaire depuis que "Détail du suivi" (/agent-rdv/dashboard/details)
                // est imbriqué sous "Tableau de bord" (/agent-rdv/dashboard) : sans ça, les
                // deux s'allumaient en même temps sur l'écran de détail.
                const isActive = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                        isActive
                          ? "bg-forest-50 font-semibold text-forest-600"
                          : "font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink",
                        collapsed && "justify-center px-0",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.75} aria-hidden className="shrink-0" />
                      {collapsed ? null : <span className="min-w-0 truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

    </aside>
  );
}
