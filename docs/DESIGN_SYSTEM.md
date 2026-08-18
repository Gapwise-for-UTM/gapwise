# Gapwise visual system

Gapwise uses a dark-first “campus after dark” visual language. Deep route blue identifies navigation and primary actions; brighter electric blue identifies time the student can reclaim. The system is intentionally small enough to maintain without a design-tool dependency.

## Foundations

- **Typography:** Geist Variable for display and interface text; Geist Mono Variable for times, labels, and compact metadata.
- **Spacing:** a 4 px base grid exposed as `--space-1` through `--space-6`, then `--space-8`, `--space-10`, and `--space-12` in `src/styles.css`.
- **Shape:** `--radius` is the base radius. Rounded geometry belongs to interactive controls, overlays, and genuinely elevated desktop surfaces; mobile primary content is intentionally flatter and integrated into the screen.
- **Motion:** `--motion-fast`, `--motion-base`, and `--motion-slow` use the shared `--ease-standard` or `--ease-out` curves. Motion must remain meaningful and respect `prefers-reduced-motion`.

## Semantic color roles

- `background`, `surface-low`, `card`, `surface-high`: page-to-elevated surface progression.
- `primary`: high-contrast action fill.
- `accent`: route, focus, and interactive emphasis.
- `gap`: detected usable time. Its brighter blue is reserved for the core product signal rather than generic success states.
- `lec`, `tut`, `pra`: timetable activity categories and the canonical cross-app class-type colors.
- `muted-foreground`: secondary copy; never reduce opacity on interactive text to create hierarchy.

Every semantic role has light and dark values. Add new roles to `@theme inline` before using them as Tailwind utilities.

### Activity color contract

Activity type is semantic, not decorative. A class must keep the same type color anywhere it is represented:

- `LEC` → `--color-lec`
- `TUT` → `--color-tut`
- `PRA` → `--color-pra`
- `OTHER` / personal fallback → neutral unless the personal item explicitly owns a color

The timetable badge, mobile class-row emphasis, Day Route sequence, map time marker, and map class details must all derive from these tokens. Do not introduce page-local blues or purples for the same activity type.

## Product primitives

- `surface`: standard elevated container with an inner highlight and restrained blur on desktop and in contexts that actually need elevation.
- `bento-hero`, `upload-card`, `landmark-card`: landing-specific composition.
- `button-primary`, `button-secondary`: shared focus, hover, and press behavior.
- `bubble-tabs`: animated view and term switcher.
- `meeting-card`: category-colored timetable event on desktop.
- `gap-window`, `gap-card`, `mobile-gap-card`: reclaimed-time emphasis.
- `empty-state`: calm radial treatment for no-data states.
- `mobile-integrated-app`: phone shell treatment that turns decorative cards into one continuous surface while preserving semantic controls and overlays.

## Mobile integrated-surface rule

The core mobile pages — Today, Timetable, Gap Plan, and Map / Day Route — should read as one continuous app canvas. Hierarchy comes from spacing, typography, hairline dividers, selection underlines, and restrained semantic glow rather than stacks of outlined rounded rectangles.

Use rounded containers on mobile only when shape communicates a real affordance or layer: text/search inputs, explicit buttons where fill is useful, map controls, sheets/dialogs, popovers, and destructive or safety-sensitive actions. A course, summary, section, or day selector should not become a card merely because it needs visual separation.

Mobile course rows must not use a timeline dot/node or decorative left rail. Their activity type is communicated through the shared semantic color system instead.

## Usage rules

1. Typography establishes hierarchy before decoration. Keep large headings tightly tracked and body copy comfortably spaced.
2. Prefer one glow per surface. Accent and gap glows should not compete in the same small component.
3. Keep normal body text at WCAG AA contrast and preserve visible keyboard focus.
4. Animate transforms and shadows; avoid entrance opacity on controls because it temporarily lowers contrast.
5. Add visual treatments through semantic classes instead of repeating long arbitrary-value strings in components.
6. On mobile, default to integrated sections and dividers; use rounded cards only when the component is genuinely elevated or interactive.
7. Never redefine LEC/TUT/PRA colors per page. The semantic tokens are the visual source of truth across timetable and map experiences.
