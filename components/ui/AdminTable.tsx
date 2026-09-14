import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface AdminTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** ex. "text-right" pour la colonne d'actions. */
  className?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  emptyMessage: string;
}

/**
 * Rendu partagé des écrans d'administration (Rôles, Utilisateurs, Listes
 * configurables, Champs personnalisés, ...) : même conteneur, même en-tête, même
 * traitement des états vide/chargement. Volontairement limité au rendu — pas de
 * tri/filtre/pagination, non demandés et non nécessaires aux volumes de données de
 * ces écrans (quelques dizaines de lignes au plus).
 */
export function AdminTable<T>({ columns, rows, rowKey, isLoading, emptyMessage }: AdminTableProps<T>) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-flat">
      {isLoading ? (
        <p className="p-6 text-sm text-ink-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
              {columns.map((col) => (
                <th key={col.header} className={cn("px-4 py-2.5 font-medium", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-surface-subtle">
                {columns.map((col) => (
                  <td key={col.header} className={cn("px-4 py-2.5", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
