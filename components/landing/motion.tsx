"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}

/**
 * L'élément est-il à l'écran ? `once` : reste vrai après la première entrée.
 * Sans IntersectionObserver (tests jsdom), considéré visible.
 */
export function useInView<T extends Element>({ once = false, margin = "0px" } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin]);

  return [ref, inView] as const;
}

/**
 * Apparition au défilement. Le contenu est visible par défaut : il n'est masqué (« armed »)
 * que s'il est hors écran au premier constat, puis animé à son entrée. Si l'observateur ne
 * tourne jamais (onglet masqué, rendu sans script), rien ne reste invisible.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (el.dataset.reveal === "armed") el.dataset.reveal = "in";
          io.disconnect();
        } else {
          el.dataset.reveal = "armed";
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className} style={delay ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}

/** Variable CSS `--i` pour les entrées échelonnées (.lp-stagger). */
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;
