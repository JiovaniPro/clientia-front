import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

/** Trois teintes de la marque (vert, terracotta, bleu info), attribuées de façon stable par dossier. */
const TONES = [
  "bg-forest-50 text-forest-600",
  "bg-terracotta-500/10 text-terracotta-600",
  "bg-status-info/10 text-status-info",
] as const;

function toneFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
}

/** Pastille d'initiales (décorative : le nom est toujours écrit à côté). */
export function ClientAvatar({
  id,
  firstName,
  lastName,
  className,
}: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  className?: string;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold", toneFor(id), className)}
    >
      {initials || <UserRound size={18} strokeWidth={1.75} />}
    </span>
  );
}
