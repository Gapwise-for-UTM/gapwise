import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Gapwise for UTM" },
      {
        name: "description",
        content: "How Gapwise handles timetable, account, planning, payment, and location data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Your schedule stays yours.">
      <section>
        <h2>Timetables and location</h2>
        <p>
          Gapwise parses ACORN .ics timetable exports in your browser. The original file is not
          uploaded. Guest mode keeps your schedule in this browser. Foreground live location is
          optional, used only while you ask for it, and is not background tracked.
        </p>
      </section>
      <section>
        <h2>Accounts and private sync</h2>
        <p>
          You may sign in with Google, Microsoft, or GitHub. Supabase provides authentication and
          stores the account identity returned by that provider. When private sync is enabled,
          normalized timetable, preferences, personal items, coursework, and academic plans are
          encrypted in the browser before cloud storage. Gapwise does not describe this design as
          end-to-end encryption or zero knowledge.
        </p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>
          If you purchase Gapwise Pro, Stripe processes checkout and payment details. Gapwise does
          not receive or store your full card number. Gapwise may store Stripe transaction or
          customer identifiers, payment status, amount and currency, and the resulting Pro access
          period so it can confirm access and handle billing support, refunds, reversals, or
          disputes.
        </p>
      </section>
      <section>
        <h2>Analytics</h2>
        <p>
          Gapwise uses privacy-conscious deployment analytics and performance measurements to
          understand aggregate product health. It does not send raw timetable entries, rooms,
          coursework titles or details, friend data, or precise location as analytics events.
        </p>
      </section>
      <section>
        <h2>AI and Quercus</h2>
        <p>
          AI features are opt-in and disclose the specific schedule and planning categories they may
          use. Coursework and academic-work details are not currently shared with Gapwise AI.
          Gapwise does not currently connect to live Quercus or collect UTORid credentials.
        </p>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Use Gapwise without an account.</li>
          <li>Turn optional sync and AI permissions off.</li>
          <li>Remove a locally remembered timetable.</li>
          <li>Delete your account and associated cloud data from account settings.</li>
        </ul>
        <p>Browser copies can also be removed through your browser's site-data controls.</p>
      </section>
    </LegalPage>
  );
}
