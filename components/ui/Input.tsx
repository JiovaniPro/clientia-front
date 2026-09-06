import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint",
          "focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600",
          error && "border-status-danger focus:ring-status-danger focus:border-status-danger",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? <span className="text-sm text-status-danger">{error}</span> : null}
    </div>
  );
}
