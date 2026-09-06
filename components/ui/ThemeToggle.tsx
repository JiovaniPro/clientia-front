"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Provisoire — juste pour valider visuellement les tokens sombres du Lot 1. Le vrai composant (rail latéral, §3.5) viendra au Lot 2. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        document.documentElement.classList.toggle("dark");
        setDark((value) => !value);
      }}
    >
      {dark ? "Mode clair" : "Mode sombre"}
    </Button>
  );
}
