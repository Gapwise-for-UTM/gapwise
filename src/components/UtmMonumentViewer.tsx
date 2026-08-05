import { useEffect, useState, type ElementType } from "react";

const ModelViewer = "model-viewer" as ElementType;

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
  const [viewerLoaded, setViewerLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void import("@google/model-viewer")
      .then(() => {
        if (mounted) setViewerLoaded(true);
      })
      .catch(() => {
        if (mounted) setViewerLoaded(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const initialOrbit = "0deg 70deg 120%";

  const skeleton = (
    <div className="flex h-full w-full items-center justify-center bg-foreground/[0.06]">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary"
        role="status"
        aria-label="Loading monument model"
      />
    </div>
  );

  return (
    <figure
      className={[
        "group relative isolate overflow-hidden rounded-3xl border border-border/80",
        "bg-gradient-to-br from-card via-muted/45 to-card shadow-sm",
        compact ? "h-44 sm:h-52" : "h-72 sm:h-80 lg:h-[23rem]",
        className,
      ].join(" ")}
      aria-label={decorative ? undefined : "Interactive model of the UTM entrance monument"}
      aria-hidden={decorative || undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 48% 38%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 52%)",
        }}
      />

      {viewerLoaded ? (
        <ModelViewer
          src="/models/utm-entrance-monument.glb?v=gray-limestone-2"
          alt="A detailed three-dimensional reconstruction of the University of Toronto Mississauga entrance monument"
          loading="eager"
          reveal="auto"
          camera-controls
          camera-orbit={initialOrbit}
          min-camera-orbit="auto 50deg 105%"
          max-camera-orbit="auto 88deg 220%"
          field-of-view="31deg"
          min-field-of-view="25deg"
          max-field-of-view="42deg"
          tone-mapping="aces"
          shadow-intensity="1.15"
          shadow-softness="0.7"
          exposure="0.38"
          environment-image="neutral"
          interaction-prompt="none"
          touch-action="pan-y"
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            display: "block",
          }}
        >
          <div slot="poster" className="h-full w-full">
            {skeleton}
          </div>
        </ModelViewer>
      ) : (
        skeleton
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/55 to-transparent" />
    </figure>
  );
}
