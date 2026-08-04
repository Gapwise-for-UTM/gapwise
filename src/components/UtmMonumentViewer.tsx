import { useEffect, useMemo, useState, type ElementType } from "react";
import { Box, RotateCcw } from "lucide-react";

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewerId = useMemo(
    () => `utm-monument-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(media.matches);
    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);

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
      media.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  function resetCamera() {
    const viewer = document.getElementById(viewerId) as
      | (HTMLElement & {
          cameraOrbit?: string;
          cameraTarget?: string;
          jumpCameraToGoal?: () => void;
        })
      | null;

    if (!viewer) return;
    viewer.cameraOrbit = "-32deg 70deg 12m";
    viewer.cameraTarget = "0m 2.45m 0m";
    viewer.jumpCameraToGoal?.();
  }

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
          id={viewerId}
          src="/models/utm-entrance-monument.glb"
          poster="/models/utm-entrance-monument-poster.png"
          alt="A detailed three-dimensional reconstruction of the University of Toronto Mississauga entrance monument"
          loading="lazy"
          reveal="auto"
          camera-controls
          auto-rotate={!reducedMotion}
          auto-rotate-delay="2200"
          rotation-per-second="7deg"
          camera-orbit="-32deg 70deg 12m"
          camera-target="0m 2.45m 0m"
          min-camera-orbit="auto 52deg 8.5m"
          max-camera-orbit="auto 84deg 17m"
          field-of-view="31deg"
          min-field-of-view="25deg"
          max-field-of-view="42deg"
          shadow-intensity="1.15"
          shadow-softness="0.8"
          exposure="1.05"
          environment-image="neutral"
          interaction-prompt="none"
          touch-action="pan-y"
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            display: "block",
          }}
        />
      ) : (
        <img
          src="/models/utm-entrance-monument-poster.png"
          alt={decorative ? "" : "UTM entrance monument"}
          className="h-full w-full object-contain p-4 sm:p-6"
          loading="lazy"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/55 to-transparent" />

      {!decorative && (
        <>
          <figcaption className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-md">
            <Box className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            UTM entrance monument
          </figcaption>

          <button
            type="button"
            onClick={resetCamera}
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/75 text-muted-foreground shadow-sm backdrop-blur-md transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Reset monument view"
            title="Reset view"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
    </figure>
  );
}
