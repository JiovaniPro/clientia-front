type ClassValue = string | number | null | undefined | false | ClassValue[];

function flatten(inputs: ClassValue[], out: string[]) {
  for (const input of inputs) {
    if (!input) continue;
    if (Array.isArray(input)) {
      flatten(input, out);
    } else {
      out.push(String(input));
    }
  }
}

/** Concatène des classes conditionnelles — pas de fusion de conflits Tailwind (pas de tailwind-merge ici, volontairement léger). */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  flatten(inputs, out);
  return out.join(" ");
}
