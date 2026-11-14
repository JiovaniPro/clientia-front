import { Gravitas_One } from "next/font/google";

/**
 * Police de titrage des pages publiques (landing, connexion) : Gravitas One, une seule graisse (400).
 * L'app connectée garde Inter.
 * Poser `displayFont.variable` sur la racine de la page, avec [data-landing] ou .brand-type
 * qui branchent --font-display dessus.
 */
export const displayFont = Gravitas_One({ subsets: ["latin"], weight: "400", variable: "--font-landing" });
