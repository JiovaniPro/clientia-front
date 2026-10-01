import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "./Logo";
import { PublicHeader } from "./PublicHeader";

/** Sous-lot 1 landing — Logo (clair/sombre, plein/mini) et en-tête public. */
afterEach(() => document.documentElement.classList.remove("dark"));

describe("Logo", () => {
  it.each([
    ["full", "logo-full"],
    ["mini", "logo-mini"],
  ] as const)("variante %s : les deux thèmes rendus, bascule par la classe .dark (CSS, sans JS)", (variant, file) => {
    render(<Logo variant={variant} />);
    const [light, dark] = screen.getAllByAltText("CLIENTIA");
    expect(light!.getAttribute("src")).toContain(`${file}-light.png`);
    expect(dark!.getAttribute("src")).toContain(`${file}-dark.png`);
    expect(light).toHaveClass("dark:hidden");
    expect(dark).toHaveClass("hidden", "dark:block");
  });

  it("hauteur passée en className, largeur auto (ratio conservé)", () => {
    render(<Logo className="h-8" />);
    for (const img of screen.getAllByAltText("CLIENTIA")) expect(img).toHaveClass("h-8", "w-auto");
  });
});

describe("PublicHeader", () => {
  it("logo vers l'accueil, lien Connexion vers /login, bascule de thème", () => {
    render(<PublicHeader />);
    const home = screen.getAllByAltText("CLIENTIA")[0]!.closest("a");
    expect(home).toHaveAttribute("href", "/");

    const nav = screen.getByRole("navigation", { name: "Navigation publique" });
    expect(within(nav).getByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/login");

    fireEvent.click(within(nav).getByRole("button", { name: "Mode sombre" }));
    expect(document.documentElement).toHaveClass("dark");
  });

  it("aucun lien d'inscription (inscription publique fermée)", () => {
    render(<PublicHeader />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/login"]);
    expect(screen.queryByText(/inscri|créer une organisation/i)).not.toBeInTheDocument();
  });
});
