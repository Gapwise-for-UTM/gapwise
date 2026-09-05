import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility — Gapwise for UTM" },
      {
        name: "description",
        content:
          "Gapwise's accessibility target, current test evidence, known limitations, and feedback path.",
      },
    ],
  }),
  component: AccessibilityPage,
});

function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Accessibility"
      title="Access is an ongoing practice."
      dateLabel="Last reviewed"
      date="August 28, 2026"
    >
      <section>
        <h2>Our target</h2>
        <p>
          Gapwise uses WCAG 2.2 Level AA as its product and review target. This is a process
          commitment, not a claim that every page or feature currently conforms. Gapwise has not
          received a third-party accessibility audit or certification.
        </p>
      </section>

      <section>
        <h2>What we currently test</h2>
        <p>
          Maintained Playwright journeys run axe-core on selected landing, timetable, gap-planning,
          Day Route, campus-explorer, theme, and export-dialog states. The automated gate rejects
          serious and critical axe findings on those tested states. Browser tests also exercise
          selected keyboard interactions, dialog focus restoration, semantic control state, and
          reduced-motion behavior.
        </p>
        <p>
          These checks cover important states, not every state or every WCAG success criterion. A
          clean automated scan does not establish conformance.
        </p>
      </section>

      <section>
        <h2>Keyboard, motion, and screen readers</h2>
        <ul>
          <li>
            Keyboard regression tests cover representative primary controls, campus search, and
            opening and closing the timetable export dialog with focus returned to its trigger.
          </li>
          <li>
            Non-essential animation is designed to respect the browser&apos;s reduced-motion
            preference; automated tests cover selected map and 3D behavior.
          </li>
          <li>
            Semantic HTML, accessible names, control state, and status announcements are reviewed in
            code and partly checked by axe and browser assertions.
          </li>
        </ul>
        <p>
          No documented, repeatable manual screen-reader test pass is currently part of the release
          evidence. We do not present automated semantic checks as screen-reader testing.
        </p>
      </section>

      <section>
        <h2>Known limitations</h2>
        <ul>
          <li>Automated coverage is sampled and cannot detect every accessibility barrier.</li>
          <li>
            Formal manual testing with screen readers, browser zoom, voice control, and a broader
            real-device matrix remains to be completed and recorded.
          </li>
          <li>
            Production sign-in journeys involving external identity providers are outside local
            automated coverage.
          </li>
          <li>
            Campus route accessibility depends on separately verified physical data. Gapwise keeps
            unverified entrances and path segments marked unknown rather than assuming they are
            step-free.
          </li>
        </ul>
      </section>

      <section>
        <h2>Accessibility feedback</h2>
        <p>
          A dedicated accessibility contact channel and response-time commitment have not yet been
          verified. For non-sensitive feedback, open a public issue in the{" "}
          <a
            href="https://github.com/Gapwise-for-UTM/gapwise/issues"
            className="text-accent hover:underline"
          >
            Gapwise GitHub repository
          </a>{" "}
          and include the page, what you were trying to do, and the browser or assistive technology
          used. Do not post personal timetable, account, location, or disability information in a
          public issue. A private, accessibility-specific contact path remains an operational
          requirement before sensitive reports can be invited.
        </p>
      </section>

      <section>
        <h2>Review history</h2>
        <p>
          August 28, 2026 — first evidence-backed statement prepared from the maintained
          accessibility regression suite. Material changes to testing scope or known limitations
          should trigger another review.
        </p>
      </section>
    </LegalPage>
  );
}
