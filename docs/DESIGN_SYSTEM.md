# Gapwise visual system

Gapwise uses a dark-first “campus after dark” visual language. Route blue identifies navigation and primary actions; mint identifies time the student can reclaim. The system is intentionally small enough to maintain without a design-tool dependency.

## Foundations

- **Typography:** Geist Variable for display and interface text; Geist Mono Variable for times, labels, and compact metadata.
- **Spacing:** a 4 px base grid exposed as `--space-1` through `--space-6`, then `--space-8`, `--space-10`, and `--space-12` in `src/styles.css`.
- **Shape:** `--radius` is the base radius. Controls use `lg`/`xl`; product surfaces use `2xl`/`3xl`.
- **Motion:** `--motion-fast`, `--motion-base`, and `--motion-slow` use the shared `--ease-standard` or `--ease-out` curves. Motion must remain meaningful and respect `prefers-reduced-motion`.

## Semantic color roles

- `background`, `surface-low`, `card`, `surface-high`: page-to-elevated surface progression.
- `primary`: high-contrast action fill.
- `accent`: route, focus, and interactive emphasis.
- `gap`: detected usable time. Do not use mint as a generic success color; it is the core product signal.
- `lec`, `tut`, `pra`: timetable activity categories.
- `muted-foreground`: secondary copy; never reduce opacity on interactive text to create hierarchy.

Every semantic role has light and dark values. Add new roles to `@theme inline` before using them as Tailwind utilities.

## Product primitives

- `surface`: standard elevated container with an inner highlight and restrained blur.
- `bento-hero`, `upload-card`, `landmark-card`: landing-specific composition.
- `button-primary`, `button-secondary`: shared focus, hover, and press behavior.
- `bubble-tabs`: animated view and term switcher.
- `meeting-card`: category-colored timetable event.
- `gap-window`, `gap-card`, `mobile-gap-card`: the only treatments for reclaimed-time emphasis.
- `empty-state`: calm radial treatment for no-data states.

## Usage rules

1. Typography establishes hierarchy before decoration. Keep large headings tightly tracked and body copy comfortably spaced.
2. Prefer one glow per surface. Accent and gap glows should not compete in the same small component.
3. Keep normal body text at WCAG AA contrast and preserve visible keyboard focus.
4. Animate transforms and shadows; avoid entrance opacity on controls because it temporarily lowers contrast.
5. Add visual treatments through semantic classes instead of repeating long arbitrary-value strings in components.
