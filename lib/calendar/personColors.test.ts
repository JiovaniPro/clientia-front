import { describe, expect, it } from "vitest";
import { PASTEL_PALETTE, buildPersonColors, pastelForRank } from "./personColors";

const user = (id: string, createdAt: string) => ({ id, createdAt });

describe("couleurs par personne (vue calendrier partagée)", () => {
  it("rang d'ancienneté → couleur, indépendant de l'ordre reçu", () => {
    const a = user("a", "2026-01-01T00:00:00Z");
    const b = user("b", "2026-02-01T00:00:00Z");
    expect(buildPersonColors([b, a])).toEqual(buildPersonColors([a, b]));
    expect(buildPersonColors([b, a]).get("a")).toBe(PASTEL_PALETTE[0]);
  });

  it("stable : un nouvel arrivant ne change la couleur de personne", () => {
    const before = buildPersonColors([user("a", "2026-01-01T00:00:00Z"), user("b", "2026-02-01T00:00:00Z")]);
    const after = buildPersonColors([
      user("c", "2026-03-01T00:00:00Z"),
      user("a", "2026-01-01T00:00:00Z"),
      user("b", "2026-02-01T00:00:00Z"),
    ]);
    expect(after.get("a")).toBe(before.get("a"));
    expect(after.get("b")).toBe(before.get("b"));
  });

  it("unique au-delà de la palette : 60 personnes, 60 couleurs distinctes", () => {
    const colors = Array.from({ length: 60 }, (_, i) => pastelForRank(i));
    expect(new Set(colors).size).toBe(60);
    expect(pastelForRank(12)).toMatch(/^hsl\(/);
  });
});
