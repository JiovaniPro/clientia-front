"use client";

import { Bell, ChevronDown, LogOut, Moon, Sun, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationsDrawer } from "@/components/shell/NotificationsDrawer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthContext";
import { isDarkTheme, setDarkTheme } from "@/lib/theme";

/**
 * Barre horizontale de l'app connectée. À gauche : "Bonjour, <nom>". À droite : la bascule clair/sombre, la cloche des notifications
 * (même pastille que l'entrée "Notifications" du rail, calculée par AppChrome ; elle ouvre un tiroir latéral des 5 dernières, sans changer de page) et l'avatar, qui ouvre le menu
 * du compte — "Mon compte" et "Se déconnecter" ne sont plus dans le rail.
 */
export function TopBar({ showNotificationsBadge = false }: { showNotificationsBadge?: boolean }) {
  const router = useRouter();
  const { user, hasPermission, logout } = useAuth();
  const [dark, setDark] = useState(isDarkTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menu ouvert : un clic ailleurs ou Échap le referme.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (!user) return null;

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  }

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const displayName = fullName || user.email;
  const initials = (`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || user.email[0] || "?").toUpperCase();
  const menuItemClass =
    "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <p className="min-w-0 truncate text-sm text-ink">
        Bonjour, <span className="font-semibold">{displayName}</span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {/* L'icône montre le mode vers lequel on bascule ; le libellé le dit en clair. */}
        <button
          type="button"
          onClick={() => {
            setDarkTheme(!dark);
            setDark(!dark);
          }}
          aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
          title={dark ? "Mode clair" : "Mode sombre"}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
        >
          {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </button>
        {hasPermission("notifications.view") ? (
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
            aria-label={showNotificationsBadge ? "Notifications — nouvelles notifications" : "Notifications"}
            title="Notifications"
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
              notificationsOpen ? "bg-forest-50 text-forest-600" : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
            )}
          >
            <Bell size={18} aria-hidden />
            {showNotificationsBadge ? (
              <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-surface bg-forest-600" />
            ) : null}
          </button>
        ) : null}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menu du compte"
            className="flex items-center gap-1 rounded-md p-0.5 pr-1 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-600 text-sm font-semibold text-white"
            >
              {initials}
            </span>
            <ChevronDown size={14} aria-hidden className={cn("text-ink-muted transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="Compte"
              className="app-rise absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-border bg-surface p-1 shadow-raised"
            >
              <div className="border-b border-border px-3 py-2.5">
                <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                <p className="truncate text-xs text-ink-muted">{user.roleName}</p>
              </div>
              <div className="pt-1">
                <Link href="/account" role="menuitem" onClick={() => setMenuOpen(false)} className={menuItemClass}>
                  <UserCog size={16} aria-hidden className="text-ink-muted" />
                  Mon compte
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                  className={cn(menuItemClass, "hover:text-status-danger focus-visible:text-status-danger")}
                >
                  <LogOut size={16} aria-hidden className="text-ink-muted" />
                  Se déconnecter
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {notificationsOpen ? <NotificationsDrawer onClose={() => setNotificationsOpen(false)} /> : null}

      {showLogoutConfirm ? (
        <ConfirmModal
          title="Se déconnecter"
          message="Se déconnecter maintenant ?"
          confirmLabel="Se déconnecter"
          variant="neutral"
          onConfirm={handleLogout}
          onClose={() => setShowLogoutConfirm(false)}
          isConfirming={isLoggingOut}
        />
      ) : null}
    </header>
  );
}
