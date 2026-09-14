"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";
import { ReportsOverview } from "@/components/reports/ReportsOverview";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";

function personLabel(u: UserListItemDTO) {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

/**
 * §5.17 — statistiques individuelles. Toujours scopées à `selectedUserId` (jamais
 * omis, contrairement au tableau de bord admin) : par défaut, l'agent connecté
 * lui-même — y compris pour un Administrateur, pour qui "omettre le filtre" sur
 * cet écran donnerait la vue globale déjà couverte par /admin/dashboard, pas "mes
 * propres stats". Le sélecteur d'agent n'apparaît qu'avec `reports.viewAll` —
 * sans elle, le backend ramènerait de toute façon toute autre sélection à
 * l'appelant lui-même (voir modules/reports/service.ts::resolveUserIdFilter),
 * donc un sélecteur non fonctionnel serait trompeur plutôt qu'inutile.
 */
export default function MyStatsPage() {
  const { user, hasPermission, authedFetch } = useAuth();
  const canViewAll = hasPermission("reports.viewAll");

  const [selectedUserId, setSelectedUserId] = useState(user?.id ?? "");
  const [colleagues, setColleagues] = useState<UserListItemDTO[]>([]);

  useEffect(() => {
    if (!canViewAll) return;
    authedFetch((token) => listUsers({}, token))
      .then(setColleagues)
      .catch(() => {
        // Le sélecteur reste utilisable pour "soi-même" même si la liste échoue à charger.
      });
  }, [canViewAll, authedFetch]);

  const isViewingSelf = selectedUserId === user?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">Statistiques</p>
        <h1 className="font-display text-2xl font-bold text-ink">
          {isViewingSelf ? "Mes statistiques" : "Statistiques de l'agent"}
        </h1>
      </header>

      <ReportsOverview
        userId={selectedUserId || undefined}
        extraControls={
          canViewAll && colleagues.length > 0 ? (
            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="max-w-xs"
            >
              <option value={user?.id ?? ""}>Moi-même</option>
              {colleagues
                .filter((c) => c.id !== user?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {personLabel(c)}
                  </option>
                ))}
            </Select>
          ) : null
        }
      />
    </div>
  );
}
