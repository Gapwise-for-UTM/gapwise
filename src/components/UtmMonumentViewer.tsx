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
    <figure
      className={[
        "relative isolate overflow-hidden rounded-xl border border-border/80",
        "bg-gradient-to-br from-card via-muted/30 to-card shadow-[var(--shadow-soft)]",
        "[&+p]:hidden",
        compact ? "h-44 sm:h-52" : "h-72 sm:h-80 lg:h-[23rem]",
        className,
      ].join(" ")}
      aria-label={decorative ? undefined : "Stylized UTM campus landmark"}
      aria-hidden={decorative || undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 48% 38%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 52%)",
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-8" aria-hidden="true">
        <div className="relative w-full max-w-md">
          <div className="mx-auto h-3 w-3/4 rounded-full bg-foreground/8 blur-sm" />
          <div className="relative mx-auto -mt-1 flex min-h-24 w-full items-center justify-center rounded-[1.25rem] border border-border/80 bg-background/75 px-8 shadow-sm backdrop-blur-sm">
            <div className="text-center">
              <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
                UTM
              </p>
              <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                University of Toronto Mississauga
              </p>
            </div>
          </div>
          <div className="mx-auto h-8 w-[82%] rounded-b-2xl border-x border-b border-border/60 bg-muted/45" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/55 to-transparent" />
    </figure>
  );
}
