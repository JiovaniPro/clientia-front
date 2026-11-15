"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiClient } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  organization: { id: string; name: string; slug: string };
}

/** Organisation accessible depuis la session (compte vérifié à la connexion) ; `current` = celle ouverte. */
export interface SessionOrganization {
  slug: string;
  name: string;
  current: boolean;
}

interface AuthPayload {
  accessToken: string;
  user: AuthUser;
  /** Absent des réponses d'un serveur plus ancien : traité comme une seule organisation. */
  organizations?: SessionOrganization[];
}

interface LoginInput {
  /** Facultatif : le serveur retrouve l'organisation par l'e-mail (la dernière utilisée si plusieurs). */
  organizationSlug?: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Organisations accessibles depuis la session ; plus d'une : le sélecteur d'organisation s'affiche. */
  organizations: SessionOrganization[];
  /** Ouvre l'autre organisation (nouvelle session côté serveur), puis recharge l'application sur l'accueil. */
  switchOrganization: (slug: string) => Promise<void>;
  hasPermission: (key: string) => boolean;
  /** §5.11 — applique un `AuthUser` déjà à jour (ex. après PATCH /auth/me), sans
   * toucher au token d'accès ni au cycle refresh : ce n'est pas une nouvelle
   * session, juste des champs de profil qui ont changé. */
  updateUser: (user: AuthUser) => void;
  /** Requête authentifiée avec retry automatique une fois sur 401 (via /auth/refresh). */
  authedFetch: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<SessionOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  /**
   * Garde anti-course : AuthProvider vit dans le layout racine et ne démonte
   * jamais lors d'une navigation client — le refresh silencieux au montage peut
   * donc résoudre APRÈS un login() explicite si sa promesse traînait (ex: cookie
   * de refresh d'une session précédente encore valide). Sans garde, celui qui
   * résout en dernier gagne, peu importe l'intention réelle de l'utilisateur —
   * bug réel observé (connexion explicite écrasée par un refresh silencieux
   * obsolète). Toute application de payload passe par `commitAuthPayload`, qui
   * invalide d'abord toute résolution différée plus ancienne.
   */
  const generationRef = useRef(0);

  // `isLoading` ne veut dire que "l'état d'auth initial n'est pas encore connu" —
  // il doit tomber à false dès qu'UNE résolution gagne (refresh au montage OU login
  // explicite plus rapide), pas seulement quand c'est le refresh au montage qui
  // gagne. D'où `setIsLoading(false)` dans commitAuthPayload/clearAuth eux-mêmes,
  // pas seulement dans le `.finally()` (gardé) du refresh au montage.
  const commitAuthPayload = useCallback((payload: AuthPayload) => {
    generationRef.current += 1;
    accessTokenRef.current = payload.accessToken;
    setUser(payload.user);
    setOrganizations(payload.organizations ?? []);
    setIsLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    generationRef.current += 1;
    accessTokenRef.current = null;
    setUser(null);
    setOrganizations([]);
    setIsLoading(false);
  }, []);

  /**
   * Le backend fait une vraie rotation à l'usage sur /auth/refresh (l'ancienne
   * session est révoquée, une nouvelle est émise — voir modules/auth/service.ts).
   * Ça veut dire que DEUX appels concurrents à /auth/refresh avec le même cookie
   * sont mutuellement exclusifs : le premier révoque la session que le second
   * essaie encore d'utiliser, qui échoue donc en 401 — même si l'utilisateur est
   * bien connecté. Bug réel observé : ClientDetailView déclenche 7 authedFetch
   * en parallèle (dossier + 6 listes configurables) ; si le token d'accès a
   * expiré, les 7 tombent en 401 en même temps et tentaient chacun leur propre
   * /auth/refresh — un seul gagnait, les 6 autres révoquaient la session
   * fraîchement émise et déconnectaient l'utilisateur en cours de route. Même
   * chose en dev avec le double montage React Strict Mode de l'effet ci-dessous.
   * `refreshInFlightRef` fait que tous les appelants concurrents partagent la
   * MÊME requête réseau (et donc la même session résultante) au lieu de se
   * marcher dessus.
   */
  const refreshInFlightRef = useRef<Promise<AuthPayload> | null>(null);
  const doRefresh = useCallback((): Promise<AuthPayload> => {
    if (!refreshInFlightRef.current) {
      refreshInFlightRef.current = apiClient
        .post<AuthPayload>("/auth/refresh")
        .finally(() => {
          refreshInFlightRef.current = null;
        });
    }
    return refreshInFlightRef.current;
  }, []);

  useEffect(() => {
    const generation = generationRef.current;
    doRefresh()
      .then((payload) => {
        if (generationRef.current === generation) commitAuthPayload(payload);
      })
      .catch(() => {
        if (generationRef.current === generation) clearAuth();
      });
    // biome-ignore lint: volontairement une seule fois au montage
  }, [doRefresh]);

  const login = useCallback(async (input: LoginInput) => {
    const payload = await apiClient.post<AuthPayload>("/auth/login", input);
    commitAuthPayload(payload);
  }, [commitAuthPayload]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const authedFetch = useCallback(
    async <T,>(fn: (accessToken: string) => Promise<T>): Promise<T> => {
      if (!accessTokenRef.current) throw new ApiError(401, "Non authentifié");
      try {
        return await fn(accessTokenRef.current);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const payload = await doRefresh().catch(() => {
            clearAuth();
            throw error;
          });
          commitAuthPayload(payload);
          return fn(payload.accessToken);
        }
        throw error;
      }
    },
    [commitAuthPayload, clearAuth, doRefresh],
  );

  /**
   * Rechargement complet après le changement : toutes les données affichées appartiennent à l'ancienne
   * organisation (listes, compteurs, caches de page). Le nouveau cookie de refresh est déjà posé, donc le
   * refresh silencieux au montage ouvre directement la nouvelle organisation.
   */
  const switchOrganization = useCallback(
    async (slug: string) => {
      const payload = await authedFetch((token) =>
        apiClient.post<AuthPayload>("/auth/switch-organization", { organizationSlug: slug }, token),
      );
      commitAuthPayload(payload);
      // Rechargement complet VOULU (pas router.push) : aucun état client de l'ancienne organisation ne doit survivre.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    },
    [authedFetch, commitAuthPayload],
  );

  const hasPermission = useCallback((key: string) => user?.permissions.includes(key) ?? false, [user]);

  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, organizations, switchOrganization, hasPermission, authedFetch, updateUser }),
    [user, isLoading, login, logout, organizations, switchOrganization, hasPermission, authedFetch, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
