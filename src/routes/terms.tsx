import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Gapwise for UTM" },
      {
        name: "description",
        content: "Terms for using the independent Gapwise student planning utility.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="A practical student utility.">
      <section>
        <h2>Independent project</h2>
        <p>
          Gapwise is an independent, open-source student utility. It is not an official University
          of Toronto service and is not endorsed by or affiliated with the University of Toronto.
        </p>
      </section>
      <section>
        <h2>Verify important information</h2>
        <p>
          Gapwise helps organize imported schedules, study plans, gaps, and campus routes. It can be
          incomplete or wrong. Verify classes, rooms, accessibility needs, coursework, deadlines,
          and submission status against official sources. You remain responsible for attending
          classes and completing and submitting work on time.
        </p>
      </section>
      <section>
        <h2>Assistive planning</h2>
        <p>
          Route times, leave-by suggestions, gap assessments, and study plans are assistive
          estimates, not guarantees. Conditions, closures, personal pace, and source-data coverage
          can change. Unknown route or accessibility facts remain unknown.
        </p>
      </section>
      <section>
        <h2>Free access</h2>
        <p>
          Gapwise is provided without paid feature tiers or a product checkout. Features available
          in the hosted product are not gated behind a Gapwise subscription or one-time purchase.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          The service is provided without a promise of uninterrupted availability and may change as
          the project evolves. Features may be corrected, removed, or replaced. Do not rely on
          Gapwise as the only copy of important academic information.
        </p>
      </section>
      <section>
        <h2>Open source</h2>
        <p>
          The source code is available under the repository's MIT license. That license governs
          copying and modification of the software; these terms govern use of the hosted Gapwise
          service.
        </p>
      </section>
    </LegalPage>
  );
}
