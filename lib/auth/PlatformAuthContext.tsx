"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import type { PlatformAdminDTO, PlatformAuthPayload, PlatformLoginInput } from "@/lib/api/platformAuth";
import { platformLogin, platformLogout, platformRefresh } from "@/lib/api/platformAuth";

interface PlatformAuthContextValue {
  platformAdmin: PlatformAdminDTO | null;
  isLoading: boolean;
  login: (input: PlatformLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Requête authentifiée avec retry automatique une fois sur 401 (via /platform/auth/refresh). */
  authedFetch: <T>(fn: (accessToken: string) => Promise<T>) => Promise<T>;
  /** Mémorise le dernier payload — utilisé par l'écran de changement de mot de
   * passe pour rafraîchir `mustChangePassword` sans imposer un aller-retour /me. */
  setPlatformAdmin: (admin: PlatformAdminDTO) => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

/**
 * Miroir délibéré de lib/auth/AuthContext.tsx — mêmes garde-fous anti-course
 * (génération pour ignorer un refresh silencieux obsolète, requête de refresh
 * partagée entre appelants concurrents), jamais fusionné avec lui : aucun état,
 * aucun stockage, aucune fonction en commun avec le contexte organisation. Un
 * Super Admin qui se retrouverait dans `AuthContext` (ou l'inverse) serait
 * exactement la classe de bug que §5.29 est censé rendre impossible — voir le
 * point 5 de la proposition §5.29.
 */
export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [platformAdmin, setPlatformAdminState] = useState<PlatformAdminDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const commitAuthPayload = useCallback((payload: PlatformAuthPayload) => {
    generationRef.current += 1;
    accessTokenRef.current = payload.accessToken;
    setPlatformAdminState(payload.platformAdmin);
    setIsLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    generationRef.current += 1;
    accessTokenRef.current = null;
    setPlatformAdminState(null);
    setIsLoading(false);
  }, []);

  const refreshInFlightRef = useRef<Promise<PlatformAuthPayload> | null>(null);
  const doRefresh = useCallback((): Promise<PlatformAuthPayload> => {
    if (!refreshInFlightRef.current) {
      refreshInFlightRef.current = platformRefresh().finally(() => {
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

  const login = useCallback(
    async (input: PlatformLoginInput) => {
      const payload = await platformLogin(input);
      commitAuthPayload(payload);
    },
    [commitAuthPayload],
  );

  const logout = useCallback(async () => {
    try {
      await platformLogout();
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

  const setPlatformAdmin = useCallback((admin: PlatformAdminDTO) => setPlatformAdminState(admin), []);

  const value = useMemo(
    () => ({ platformAdmin, isLoading, login, logout, authedFetch, setPlatformAdmin }),
    [platformAdmin, isLoading, login, logout, authedFetch, setPlatformAdmin],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth doit être utilisé sous PlatformAuthProvider");
  return ctx;
}
