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
          These terms apply to use of the hosted Gapwise service. They do not create a relationship
          with the University.
        </p>
      </section>
      <section>
        <h2>Using the service</h2>
        <p>
          Use Gapwise lawfully and do not attempt to bypass access controls, interfere with the
          service, misuse another person's account or data, or use delegated integrations beyond the
          permissions granted to you. You are responsible for activity you intentionally authorize
          through your account and for keeping your own devices and provider accounts secure.
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
          can change. Unknown route or accessibility facts remain unknown. Gapwise is not an
          emergency, safety, medical, accessibility-certification, or official navigation service.
        </p>
      </section>
      <section>
        <h2>Accounts, integrations, and privacy</h2>
        <p>
          An account is optional for core guest use. Signed-in, sync, friend, and AI integration
          features involve additional data processing described in the Privacy Policy. Third-party
          identity and AI services also have their own terms and privacy practices. Authorization of
          an integration does not make Gapwise responsible for an external provider's independent
          service or data handling.
        </p>
      </section>
      <section>
        <h2>Free access and payments</h2>
        <p>
          Gapwise is currently provided without paid feature tiers or a product checkout. Features
          available in the hosted product are not gated behind a Gapwise subscription or one-time
          purchase. Historical billing code or database migrations do not represent a current offer
          to charge users. If paid services are introduced, pricing, recurring-charge terms,
          cancellation, required consumer disclosures, and affirmative purchase authorization must
          be implemented before charging anyone.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          The service is provided without a promise of uninterrupted availability and may change as
          the project evolves. Features may be corrected, removed, or replaced. Do not rely on
          Gapwise as the only copy of important academic information. Material changes to data
          handling are addressed in the Privacy Policy.
        </p>
      </section>
      <section>
        <h2>Open source</h2>
        <p>
          The source code is available under the repository's MIT license. That license governs
          copying and modification of the software; these terms govern use of the hosted Gapwise
          service. Third-party software, data, identity services, and providers may have separate
          licenses or terms.
        </p>
      </section>
      <section>
        <h2>Legal review</h2>
        <p>
          These project terms are written to describe the current product without claiming that a
          disclaimer or click-through eliminates statutory rights or liability. The operator's legal
          identity, governing-law language, consumer-law requirements, age-related requirements, and
          any limitation-of-liability provisions should be reviewed by qualified counsel before the
          service is commercialized or materially expanded. Nothing here limits rights that cannot
          lawfully be waived.
        </p>
      </section>
    </LegalPage>
  );
}
