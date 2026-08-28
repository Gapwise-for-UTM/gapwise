import { useEffect, useRef, useState, type ElementType } from "react";

const ModelViewer = "model-viewer" as ElementType;

type ModelViewerElement = HTMLElement & {
  loaded?: boolean;
};

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
  const [shouldLoadViewer, setShouldLoadViewer] = useState(false);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const figureRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoadViewer(true);
      setIsVisible(true);
      return;
    }

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadViewer(true);
          preloadObserver.disconnect();
        }
      },
      // Do not start the 3D runtime and 7 MB model while the landmark is still
      // below the mobile viewport; the static shell remains immediately usable.
      { rootMargin: "0px" },
    );
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.01 },
    );
    preloadObserver.observe(figure);
    visibilityObserver.observe(figure);
    return () => {
      preloadObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadViewer) return;
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
  }, [shouldLoadViewer]);

  useEffect(() => {
    if (!viewerLoaded) return;
    const viewer = viewerRef.current;
    if (!viewer) return;

    const markReady = () => setModelReady(true);
    if (viewer.loaded) {
      markReady();
      return;
    }

    viewer.addEventListener("load", markReady);
    return () => viewer.removeEventListener("load", markReady);
  }, [viewerLoaded]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
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
      ref={figureRef}
      className={[
        "group relative isolate overflow-hidden rounded-xl border border-border/80",
        "bg-gradient-to-br from-card via-muted/30 to-card shadow-[var(--shadow-soft)]",
        compact ? "h-44 sm:h-52" : "h-72 sm:h-80 lg:h-[23rem]",
        className,
      ].join(" ")}
      data-model-ready={modelReady ? "true" : "false"}
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
          ref={viewerRef}
          src="/models/utm-entrance-monument.glb?v=single-plaque-label-6"
          alt="A detailed three-dimensional reconstruction of the University of Toronto Mississauga entrance monument"
          loading="lazy"
          reveal="auto"
          camera-controls
          auto-rotate={!reducedMotion && isVisible ? true : undefined}
          auto-rotate-delay="5000"
          rotation-per-second="4deg"
          camera-orbit={initialOrbit}
          min-camera-orbit="auto 50deg 105%"
          max-camera-orbit="auto 88deg 220%"
          field-of-view="31deg"
          min-field-of-view="25deg"
          max-field-of-view="42deg"
          tone-mapping="aces"
          shadow-intensity="1.35"
          shadow-softness="0.42"
          exposure="0.48"
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
