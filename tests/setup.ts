import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});

// next/font n'existe que dans la chaîne de build de Next : hors d'elle, la police de la landing devient une fonction neutre.
vi.mock("next/font/google", () => ({ Gravitas_One: () => ({ className: "", variable: "" }) }));
