"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";
import { ReportsOverview } from "@/components/reports/ReportsOverview";
import { TodoStrip } from "@/components/reports/TodoStrip";
import type { UserListItemDTO } from "@/lib/api/users";
import { listUsers } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthContext";
import { PageTitle } from "@/components/ui/PageTitle";

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
  const viewedColleague = colleagues.find((c) => c.id === selectedUserId);
  const viewedName = viewedColleague ? personLabel(viewedColleague) : "l'agent";

  return (
    <div className="space-y-6 p-6">
      <header>
        <PageTitle parent="Statistiques">
          {isViewingSelf ? "Mes statistiques" : `Statistiques de ${viewedName}`}
        </PageTitle>
        <p className="text-sm text-ink-muted">
          {isViewingSelf
            ? "Votre activité d'appels et de prise de rendez-vous sur la période choisie."
            : "Activité d'appels et de prise de rendez-vous de cet agent sur la période choisie."}
        </p>
      </header>

      {/* Ce qui attend l'utilisateur maintenant — uniquement sur ses propres statistiques. */}
      {isViewingSelf ? <TodoStrip /> : null}

      <ReportsOverview
        userId={selectedUserId || undefined}
        extraControls={
          canViewAll && colleagues.length > 0 ? (
            <Select
              aria-label="Agent consulté"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-64"
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
