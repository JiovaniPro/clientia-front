import { useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink",
          "focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-forest-600",
          error && "border-status-danger focus:ring-status-danger focus:border-status-danger",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-sm text-status-danger">{error}</span> : null}
    </div>
  );
}
