import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config — en-têtes de sécurité", () => {
  it("/reset-password (jeton à usage unique dans l'URL) reçoit Referrer-Policy: no-referrer", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/reset-password");
    expect(rule?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });

  it("l'en-tête est réservé à cette page : aucune règle globale (/:path*) ne l'étend aux autres écrans", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source)).toEqual(["/reset-password"]);
  });
});
