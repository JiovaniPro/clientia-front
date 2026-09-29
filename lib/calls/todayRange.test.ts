import { describe, expect, it } from "vitest";
import { todayRange } from "./todayRange";

describe("todayRange", () => {
  it("couvre exactement la journée locale de l'instant donné", () => {
    const { changedFrom, changedTo } = todayRange(new Date(2026, 8, 21, 14, 30));
    expect(new Date(changedFrom)).toEqual(new Date(2026, 8, 21, 0, 0, 0, 0));
    expect(new Date(changedTo)).toEqual(new Date(2026, 8, 21, 23, 59, 59, 999));
  });

  it("un instant à 00:00:00 et un à 23:59:59 tombent dans la même plage", () => {
    const a = todayRange(new Date(2026, 8, 21, 0, 0, 0));
    const b = todayRange(new Date(2026, 8, 21, 23, 59, 59));
    expect(a).toEqual(b);
  });
});
