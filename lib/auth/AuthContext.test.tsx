import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("@/lib/api/client", () => {
  class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
    buildQuery: vi.fn(),
  };
});

import { apiClient } from "@/lib/api/client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const baseUser = {
  id: "u1",
  firstName: null,
  lastName: null,
  roleId: "r1",
  roleName: "Administrateur",
  permissions: [] as string[],
  organization: { id: "o1", name: "Org", slug: "org" },
};

function sessionPayload(label: "A" | "B") {
  return { accessToken: `token-${label}`, user: { ...baseUser, email: `session${label}@test.local` } };
}

function TestConsumer() {
  const { user, isLoading, login } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user-email">{user?.email ?? "none"}</span>
      <button type="button" onClick={() => login({ organizationSlug: "org", email: "x", password: "x" })}>
        login
      </button>
    </div>
  );
}

describe("AuthContext — course entre le refresh silencieux au montage et un login explicite", () => {
  beforeEach(() => {
    (apiClient.post as Mock).mockReset();
  });

  /**
   * Scénario exact du bug corrigé : une session A se connecte explicitement pendant
   * qu'un refresh silencieux au montage (représentant une session B obsolète — cookie
   * de refresh d'une session précédente encore valide dans le navigateur) est encore
   * en vol. Le refresh de B résout APRÈS le login de A. Sans la garde de génération
   * (voir AuthContext.tsx), B écraserait silencieusement A au moment où sa promesse
   * finit par résoudre — c'est le bug réellement observé pendant les tests manuels
   * du lot 3 (calls créés sous le mauvais utilisateur/organisation).
   */
  it("la session explicitement connectée (A) reste active même si un refresh obsolète (B) résout après coup", async () => {
    const refreshDeferred = deferred<ReturnType<typeof sessionPayload>>();
    const loginDeferred = deferred<ReturnType<typeof sessionPayload>>();

    (apiClient.post as Mock).mockImplementation((path: string) => {
      if (path === "/auth/refresh") return refreshDeferred.promise;
      if (path === "/auth/login") return loginDeferred.promise;
      throw new Error(`chemin inattendu dans le test : ${path}`);
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // le refresh silencieux (B) est déclenché au montage, avant toute action utilisateur
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/auth/refresh"));

    // l'utilisateur se connecte explicitement (A) pendant que le refresh de B est encore en vol
    await act(async () => {
      screen.getByText("login").click();
    });

    // A résout en premier
    await act(async () => {
      loginDeferred.resolve(sessionPayload("A"));
    });
    await waitFor(() => expect(screen.getByTestId("user-email")).toHaveTextContent("sessionA@test.local"));

    // B (obsolète) résout ensuite — ne doit PAS écraser A
    await act(async () => {
      refreshDeferred.resolve(sessionPayload("B"));
    });

    expect(screen.getByTestId("user-email")).toHaveTextContent("sessionA@test.local");
  });

  /**
   * Chemin inverse explicitement testé (pas seulement rencontré par accident) :
   * quand le login explicite gagne la course, `isLoading` doit tomber à false dès
   * cette résolution — sans attendre que le refresh obsolète (perdant) résolve à son
   * tour. C'est le second bug introduit par le premier correctif (la garde de
   * génération faisait aussi sauter le `.finally()` qui posait isLoading à false,
   * sans rien pour le remplacer sur le chemin du login).
   */
  it("isLoading ne reste jamais bloqué à true quand le login gagne la course contre le refresh", async () => {
    const refreshDeferred = deferred<ReturnType<typeof sessionPayload>>();
    const loginDeferred = deferred<ReturnType<typeof sessionPayload>>();

    (apiClient.post as Mock).mockImplementation((path: string) => {
      if (path === "/auth/refresh") return refreshDeferred.promise;
      if (path === "/auth/login") return loginDeferred.promise;
      throw new Error(`chemin inattendu dans le test : ${path}`);
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/auth/refresh"));
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      screen.getByText("login").click();
    });
    await act(async () => {
      loginDeferred.resolve(sessionPayload("A"));
    });

    // isLoading doit passer à false ici, SANS attendre la résolution du refresh obsolète
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    // le refresh obsolète résout ensuite — isLoading ne doit ni rester bloqué ni repasser à true
    await act(async () => {
      refreshDeferred.resolve(sessionPayload("B"));
    });

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("cas de base : le refresh silencieux seul (sans login concurrent) résout normalement isLoading", async () => {
    const refreshDeferred = deferred<ReturnType<typeof sessionPayload>>();
    (apiClient.post as Mock).mockImplementation((path: string) => {
      if (path === "/auth/refresh") return refreshDeferred.promise;
      throw new Error(`chemin inattendu dans le test : ${path}`);
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      refreshDeferred.resolve(sessionPayload("A"));
    });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user-email")).toHaveTextContent("sessionA@test.local");
  });
});

describe("AuthContext — déduplication des refresh concurrents", () => {
  beforeEach(() => {
    (apiClient.post as Mock).mockReset();
  });

  /**
   * Bug réel trouvé en vérifiant §P0.4 en conditions réelles (lot 4) : le backend fait
   * une vraie rotation à l'usage sur /auth/refresh (ancienne session révoquée, nouvelle
   * émise — modules/auth/service.ts). ClientDetailView lance 7 authedFetch en parallèle
   * (dossier + 6 listes configurables) ; si le token d'accès est expiré, les 7 tombent
   * en 401 en même temps. Sans déduplication, chacun appelait son propre /auth/refresh —
   * un seul gagnait la course de rotation côté backend, les 6 autres recevaient 401 sur
   * LEUR propre refresh et déconnectaient l'utilisateur (observé en direct : redirection
   * inattendue vers /login juste après une connexion réussie). Ce test prouve que
   * plusieurs authedFetch concurrents qui expirent en même temps ne déclenchent qu'UN
   * seul appel réseau /auth/refresh, et que tous se retrouvent bien avec la session
   * fraîchement émise plutôt que d'échouer.
   */
  it("plusieurs authedFetch concurrents en 401 ne déclenchent qu'un seul /auth/refresh et réussissent tous", async () => {
    const mountRefreshDeferred = deferred<ReturnType<typeof sessionPayload>>();
    const dedupRefreshDeferred = deferred<ReturnType<typeof sessionPayload>>();
    let refreshCallCount = 0;

    (apiClient.post as Mock).mockImplementation((path: string) => {
      if (path === "/auth/refresh") {
        refreshCallCount += 1;
        return refreshCallCount === 1 ? mountRefreshDeferred.promise : dedupRefreshDeferred.promise;
      }
      throw new Error(`chemin inattendu dans le test : ${path}`);
    });

    function makeFlakyFn() {
      let calls = 0;
      const seenTokens: string[] = [];
      const fn = async (token: string) => {
        calls += 1;
        seenTokens.push(token);
        if (calls === 1) throw new ApiError(401, "token expiré");
        return token;
      };
      return { fn, seenTokens };
    }

    let authedFetchRef: (<T>(fn: (token: string) => Promise<T>) => Promise<T>) | null = null;
    function AuthedFetchConsumer() {
      const { authedFetch, isLoading } = useAuth();
      const ref = useRef(authedFetch);
      ref.current = authedFetch;
      useEffect(() => {
        authedFetchRef = ref.current;
      });
      return <span data-testid="loading2">{String(isLoading)}</span>;
    }

    render(
      <AuthProvider>
        <AuthedFetchConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(refreshCallCount).toBe(1));
    await act(async () => {
      mountRefreshDeferred.resolve(sessionPayload("A"));
    });
    await waitFor(() => expect(screen.getByTestId("loading2")).toHaveTextContent("false"));

    const clients = [makeFlakyFn(), makeFlakyFn(), makeFlakyFn()];
    let results: string[] = [];
    await act(async () => {
      const calls = clients.map(({ fn }) => authedFetchRef!(fn));
      await waitFor(() => expect(refreshCallCount).toBe(2));
      dedupRefreshDeferred.resolve(sessionPayload("B"));
      results = await Promise.all(calls);
    });

    expect(refreshCallCount).toBe(2); // 1 au montage + 1 seul de plus pour les 3 401 concurrents
    expect(results).toEqual(["token-B", "token-B", "token-B"]);
    for (const { seenTokens } of clients) {
      expect(seenTokens).toEqual(["token-A", "token-B"]);
    }
  });
});
