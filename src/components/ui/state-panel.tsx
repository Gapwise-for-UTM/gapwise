import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type StatePanelProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function StatePanel({
  title,
  description,
  eyebrow,
  icon,
  actions,
  children,
  className,
}: StatePanelProps) {
  return (
    <section
      className={cn(
        "surface flex flex-col items-center p-7 text-center sm:p-10",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8 text-accent">
          {icon}
        </span>
      ) : null}
      {eyebrow ? <p className={cn("eyebrow text-accent", icon && "mt-5")}>{eyebrow}</p> : null}
      <h2
        className={cn(
          "font-display text-2xl font-semibold tracking-tight",
          icon || eyebrow ? "mt-2" : undefined,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {children}
      {actions ? <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:flex-row">{actions}</div> : null}
    </section>
  );
}

type LoadingPanelProps = {
  title: string;
  description?: string;
  className?: string;
  compact?: boolean;
};

export function LoadingPanel({ title, description, className, compact = false }: LoadingPanelProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface-low/45 text-left",
        compact ? "p-4" : "p-5 sm:p-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="font-display text-base font-semibold tracking-tight">{title}</p>
      {description ? (
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3" aria-hidden="true">
        <div className="space-y-3 pt-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-[72%]" />
          <Skeleton className="ml-[18%] h-14 w-[78%]" />
          <Skeleton className="h-9 w-[58%]" />
        </div>
      </div>
    </section>
  );
}
