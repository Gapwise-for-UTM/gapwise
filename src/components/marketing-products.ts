export type MarketingProductId =
  "gapwise" | "gapwise-ai" | "gapwise-docs" | "gapwise-data" | "gapwise-status";

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
