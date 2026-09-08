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

export type MarketingProductId =
  | "gapwise"
  | "gapwise-ai"
  | "gapwise-docs"
  | "gapwise-data"
  | "gapwise-status";

export const MARKETING_PRODUCTS: ReadonlyArray<{
  id: MarketingProductId;
  label: string;
  shortLabel: string;
  href: string;
}> = [
  { id: "gapwise", label: "Gapwise", shortLabel: "Gapwise", href: "https://gapwise.ca" },
  { id: "gapwise-ai", label: "Gapwise AI", shortLabel: "AI", href: "https://ai.gapwise.ca" },
  {
    id: "gapwise-docs",
    label: "Gapwise Docs",
    shortLabel: "Docs",
    href: "https://docs.gapwise.ca",
  },
  {
    id: "gapwise-data",
    label: "Gapwise Data",
    shortLabel: "Data",
    href: "https://data.gapwise.ca",
  },
  {
    id: "gapwise-status",
    label: "Gapwise Status",
    shortLabel: "Status",
    href: "https://status.gapwise.ca",
  },
];

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
