import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

function setup(initial: Record<string, unknown>) {
  return renderHook(({ values }) => useUnsavedChangesGuard(values, vi.fn()), { initialProps: { values: initial } });
}

function fireBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("§6.25 — calcul de modification", () => {
  it("valeur inchangée : pas modifié", () => {
    const { result, rerender } = setup({ name: "Admin", keys: new Set(["a"]) });
    rerender({ values: { name: "Admin", keys: new Set(["a"]) } });
    expect(result.current.isDirty).toBe(false);
  });

  it("valeur modifiée puis restaurée à l'identique : pas modifié", () => {
    const { result, rerender } = setup({ name: "Admin" });
    rerender({ values: { name: "Admin2" } });
    expect(result.current.isDirty).toBe(true);
    rerender({ values: { name: "Admin" } });
    expect(result.current.isDirty).toBe(false);
  });

  it("Set modifié : modifié ; même contenu dans un autre ordre : pas modifié", () => {
    const { result, rerender } = setup({ keys: new Set(["a", "b"]) });
    rerender({ values: { keys: new Set(["a", "b", "c"]) } });
    expect(result.current.isDirty).toBe(true);
    rerender({ values: { keys: new Set(["b", "a"]) } });
    expect(result.current.isDirty).toBe(false);
  });

  it("ready : pré-remplissage avant ready ignoré, référence prise au passage à ready", () => {
    const { result, rerender } = renderHook(
      ({ values, ready }) => useUnsavedChangesGuard(values, vi.fn(), ready),
      { initialProps: { values: { country: "" } as Record<string, unknown>, ready: false } },
    );
    rerender({ values: { country: "FR" }, ready: false }); // défaut chargé
    expect(result.current.isDirty).toBe(false);
    rerender({ values: { country: "FR" }, ready: true });
    expect(result.current.isDirty).toBe(false);
    rerender({ values: { country: "BE" }, ready: true });
    expect(result.current.isDirty).toBe(true);
    rerender({ values: { country: "FR" }, ready: true });
    expect(result.current.isDirty).toBe(false);
  });

  it("beforeunload n'est intercepté que si modifié", () => {
    const { rerender, unmount } = setup({ name: "Admin" });
    expect(fireBeforeUnload()).toBe(false);
    rerender({ values: { name: "Autre" } });
    expect(fireBeforeUnload()).toBe(true);
    rerender({ values: { name: "Admin" } });
    expect(fireBeforeUnload()).toBe(false);
    rerender({ values: { name: "Autre" } });
    unmount();
    expect(fireBeforeUnload()).toBe(false);
  });
});
