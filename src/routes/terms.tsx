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
    <LegalPage eyebrow="Terms" title="A practical student utility." date="August 30, 2026">
      <section>
        <h2>Using Gapwise</h2>
        <p>
          These terms govern use of the hosted Gapwise service. You can use many features in guest
          mode without an account. If you choose to sign in, the sign-in flow asks you to agree to
          these terms and acknowledge the Privacy Policy before continuing.
        </p>
      </section>

      <section>
        <h2>Independent project</h2>
        <p>
          Gapwise is an independent, open-source student utility. It is not an official University
          of Toronto service and is not endorsed by or affiliated with the University of Toronto.
          University names and campus information are used only to describe the product's subject
          matter and source-backed campus data.
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
        <h2>Assistive planning, not professional advice</h2>
        <p>
          Route times, leave-by suggestions, gap assessments, and study plans are assistive
          estimates, not guarantees. Conditions, closures, personal pace, and source-data coverage
          can change. Unknown route or accessibility facts remain unknown. Gapwise does not provide
          academic, accessibility, medical, legal, financial, or other professional advice.
        </p>
      </section>

      <section>
        <h2>Your data and content</h2>
        <p>
          You keep your rights in timetable files, personal planning items, notes, preferences, and
          other content you provide. You permit Gapwise and the service providers needed for the
          features you choose to process that content only as necessary to operate, secure, and
          improve those requested features, subject to the Privacy Policy and applicable law.
        </p>
        <p>
          Do not upload or submit content you do not have the right to use, or use Gapwise to expose
          another person's private information without authorization.
        </p>
      </section>

      <section>
        <h2>Accounts and acceptable use</h2>
        <p>
          Keep control of your own sign-in session and connected providers. Do not attempt to access
          another person's account or data, bypass authorization or rate limits, interfere with the
          service, probe production in a way that risks other users, impersonate another person, or
          use Gapwise for unlawful activity. Good-faith security research must follow the{" "}
          <a href="/security">Vulnerability Disclosure Policy</a>.
        </p>
      </section>

      <section>
        <h2>AI and third-party services</h2>
        <p>
          Optional sign-in, maps, hosting, analytics, and AI features depend on third-party services
          such as Supabase, Vercel, Google, Microsoft, GitHub, map infrastructure, and AI providers
          you choose. Those services have their own terms, privacy practices, availability, and
          account controls. Gapwise cannot guarantee that an external provider will remain available
          or preserve a particular feature forever.
        </p>
        <p>
          AI output can be incomplete or wrong. Academic timetable facts remain source-backed and
          read-only through the Gapwise AI integration; supported AI writes are limited to bounded
          personal planning actions and preferences that the user has explicitly authorized.
        </p>
      </section>

      <section>
        <h2>Free access and payments</h2>
        <p>
          Gapwise is currently provided without paid feature tiers, subscriptions, trials that
          convert to paid plans, or a product checkout. Gapwise does not currently charge users
          through the hosted application. If paid features are introduced later, the product and
          terms must be updated before charging begins so price, timing, renewal, cancellation, and
          consent are clear before payment is taken.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          The service is provided without a promise of uninterrupted availability and may change as
          the project evolves. Features may be corrected, removed, or replaced. Do not rely on
          Gapwise as the only copy of important academic information. Material changes to these terms
          should be published before they govern new use where notice or renewed agreement is
          required by applicable law.
        </p>
      </section>

      <section>
        <h2>Suspension and termination</h2>
        <p>
          Access may be limited or suspended when reasonably necessary to protect users, investigate
          abuse, comply with law, or preserve the security and integrity of the service. You may stop
          using Gapwise at any time and signed-in users can permanently delete their Gapwise account
          and associated cloud data from account settings, subject to provider-side logs and backups
          described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Warranty and liability limits</h2>
        <p>
          Gapwise is provided on an "as is" and "as available" basis to the extent permitted by law,
          without warranties that the service will be error-free, uninterrupted, or suitable for a
          particular academic, routing, accessibility, or planning outcome. To the extent permitted
          by law, Gapwise is not responsible for indirect, incidental, special, consequential, or
          punitive losses arising from use of the service.
        </p>
        <p>
          Nothing in these terms excludes or limits rights, remedies, warranties, or liability that
          applicable law does not allow to be excluded or limited. These terms are not a substitute
          for legal review of the operator's actual structure, governing law, or jurisdiction.
        </p>
      </section>

      <section>
        <h2>Open source</h2>
        <p>
          The source code is available under the repository's MIT license. That license governs
          copying and modification of the software; these terms govern use of the hosted Gapwise
          service. Third-party code and services remain subject to their own licenses and terms.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          For non-sensitive questions about these terms, use the{" "}
          <a href="https://github.com/andrewmuratov/gapwise">Gapwise repository</a>. Do not post
          private account data, credentials, legal documents, or vulnerability details in a public
          issue. Legal notices or requests that require a private channel should first be directed to
          the repository owner through the <a href="https://github.com/andrewmuratov">GitHub profile</a>.
        </p>
      </section>
    </LegalPage>
  );
}
