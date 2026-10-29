import { describe, expect, it } from "vitest";
import { isAgentRdvNavProfile } from "./navItems";

const has = (keys: string[]) => (key: string) => keys.includes(key);

describe("isAgentRdvNavProfile", () => {
  it("bascule l'Agent RDV sur sa nav dédiée", () => {
    expect(isAgentRdvNavProfile(has(["calendar.manageAppointments", "calls.view"]))).toBe(true);
  });

  it("garde la nav complète (et 'À appeler') pour un calliste qui a aussi calendar.manageAppointments", () => {
    expect(isAgentRdvNavProfile(has(["calendar.manageAppointments", "calls.view", "calls.create"]))).toBe(false);
  });
});
