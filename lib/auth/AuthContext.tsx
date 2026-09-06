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

interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

interface LoginInput {
  organizationSlug: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  /** Requête authentifiée avec retry automatique une fois sur 401 (via /auth/refresh). */
  authedFetch: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
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
    setIsLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    generationRef.current += 1;
    accessTokenRef.current = null;
    setUser(null);
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

  const hasPermission = useCallback((key: string) => user?.permissions.includes(key) ?? false, [user]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, hasPermission, authedFetch }),
    [user, isLoading, login, logout, hasPermission, authedFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
