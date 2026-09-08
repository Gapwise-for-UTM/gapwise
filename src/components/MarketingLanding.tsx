import type { ComponentProps } from "react";
import { lazy, Suspense } from "react";
import type { UploadPanel } from "@/components/UploadPanel";

type UploadProps = Pick<
  ComponentProps<typeof UploadPanel>,
  "onFile" | "onDemo" | "loading" | "error" | "remember" | "onRememberChange"
>;

export type MarketingLandingProps = UploadProps & {
  isOnline: boolean;
  rememberAvailable: boolean;
};

const MarketingLandingImpl = lazy(() =>
  import("./MarketingLandingImpl").then((module) => ({ default: module.MarketingLandingImpl })),
);

export function MarketingLanding(props: MarketingLandingProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[38rem] border-y border-border" role="status" aria-live="polite">
          <span className="sr-only">Loading Gapwise…</span>
        </div>
      }
    >
      <MarketingLandingImpl {...props} />
    </Suspense>
  );
}
