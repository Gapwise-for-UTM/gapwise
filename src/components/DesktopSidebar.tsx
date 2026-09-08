import { lazy, Suspense } from "react";
import type { Theme } from "@/hooks/use-preferences";
import type { AppDestination } from "@/features/navigation/use-app-navigation";

const DesktopSidebarImpl = lazy(() =>
  import("./DesktopSidebarImpl").then((module) => ({ default: module.DesktopSidebar })),
);

type DesktopSidebarProps = {
  destination: AppDestination;
  arrivalLabel: string;
  theme: Theme;
  onOpenArrival: () => void;
  onOpenAccount: () => void;
  onToggleTheme: () => void;
};

export function DesktopSidebar(props: DesktopSidebarProps) {
  return (
    <Suspense fallback={null}>
      <DesktopSidebarImpl {...props} />
    </Suspense>
  );
}
