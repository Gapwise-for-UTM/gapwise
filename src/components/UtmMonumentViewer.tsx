type UtmMonumentViewerProps = {
  className?: string;
  compact?: boolean;
  decorative?: boolean;
};

export function UtmMonumentViewer({
  className = "",
  compact = false,
  decorative = false,
}: UtmMonumentViewerProps) {
  return (
    <div
      className={[
        "grid gap-2 rounded-xl border border-border/80 bg-card/40 p-4 shadow-[var(--shadow-soft)]",
        "[&+p]:hidden",
        compact ? "sm:p-5" : "p-5 sm:p-6",
        className,
      ].join(" ")}
      aria-label={decorative ? undefined : "Gapwise campus routing capabilities"}
      aria-hidden={decorative || undefined}
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Building entrances</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-accent">
          Mapped
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Room-to-room context</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-accent">
          Native
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">Step-free routing</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-accent">
          Aware
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">3D runtime</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          None
        </span>
      </div>
    </div>
  );
}
