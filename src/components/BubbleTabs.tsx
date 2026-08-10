import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

export type BubbleTabItem<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
};

export function BubbleTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
  compact = false,
}: {
  items: BubbleTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  compact?: boolean;
}) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const style = {
    "--bubble-count": items.length,
    "--bubble-index": selectedIndex,
  } as CSSProperties;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    if (items.length === 0) return;
    event.preventDefault();
    const buttons = Array.from(
      tablistRef.current?.querySelectorAll<HTMLButtonElement>(".bubble-tab") ?? [],
    );
    const focusedIndex = buttons.findIndex((button) => button === document.activeElement);
    const currentIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex;
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() => {
      buttons[nextIndex]?.focus();
    });
  }

  return (
    <div
      ref={tablistRef}
      role="group"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`bubble-tabs ${compact ? "bubble-tabs-compact" : ""} ${className}`}
      style={style}
    >
      <span className="bubble-tabs-indicator" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-label={item.ariaLabel}
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className="bubble-tab"
          >
            {item.icon}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
