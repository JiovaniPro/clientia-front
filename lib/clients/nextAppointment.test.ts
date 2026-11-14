import { describe, expect, it } from "vitest";
import { describeNextAppointment } from "./nextAppointment";

// Jeudi 12 novembre 2026, 10:00 (heure locale).
const NOW = new Date(2026, 10, 12, 10, 0);
const at = (y: number, m: number, d: number, h = 14, min = 30) => new Date(y, m, d, h, min).toISOString();

describe("describeNextAppointment", () => {
  it("aucun rendez-vous", () => {
    expect(describeNextAppointment(null, NOW)).toEqual({ label: "Aucun RDV planifié", time: null, tone: "none" });
  });

  it("aujourd'hui (même plus tard dans la journée), demain, puis le jour de la semaine", () => {
    expect(describeNextAppointment(at(2026, 10, 12, 17, 0), NOW)).toMatchObject({ label: "Aujourd'hui", time: "17:00", tone: "today" });
    expect(describeNextAppointment(at(2026, 10, 13), NOW)).toMatchObject({ label: "Demain", time: "14:30", tone: "soon" });
    expect(describeNextAppointment(at(2026, 10, 16), NOW)).toMatchObject({ label: "Lundi", tone: "soon" });
  });

  it("au-delà d'une semaine : date courte, avec l'année si ce n'est pas la même", () => {
    expect(describeNextAppointment(at(2026, 10, 19), NOW)).toMatchObject({ label: "19 nov.", tone: "later" });
    expect(describeNextAppointment(at(2027, 0, 5), NOW).label).toBe("5 janv. 2027");
  });
});
