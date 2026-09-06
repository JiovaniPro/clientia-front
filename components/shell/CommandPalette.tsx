"use client";

import type { LucideIcon } from "lucide-react";
import { LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthContext";
import { isNavItemVisible, NAV_ITEMS } from "@/lib/nav/navItems";

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
}

/**
 * Les destinations viennent de `NAV_ITEMS` (partagé avec SideRail) et sont filtrées
 * par permission de la même façon — sans ça la palette de commandes proposait des
 * destinations que le rail masquait déjà, rouvrant le même gap par une autre porte.
 */
export function CommandPalette() {
  const router = useRouter();
  const { logout, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const commands: Command[] = useMemo(
    () => [
      ...NAV_ITEMS.filter((item) => isNavItemVisible(item.permission, hasPermission)).map((item) => ({
        id: item.href,
        label: item.paletteLabel,
        icon: item.icon,
        run: () => router.push(item.href),
      })),
      {
        id: "logout",
        label: "Se déconnecter",
        icon: LogOut,
        run: () => {
          logout().then(() => router.push("/login"));
        },
      },
    ],
    [router, logout, hasPermission],
  );

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setActiveIndex(0);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function runCommand(command: Command) {
    command.run();
    setOpen(false);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      runCommand(filtered[activeIndex]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 pt-32" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Rechercher une action…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="rounded-sm border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-ink-muted">
            Esc
          </kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">Aucune action trouvée.</li>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <li key={command.id}>
                  <button
                    type="button"
                    onClick={() => runCommand(command)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                      index === activeIndex ? "bg-forest-50 text-forest-600" : "text-ink",
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {command.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
