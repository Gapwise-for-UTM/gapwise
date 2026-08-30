import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Gapwise for UTM" },
      {
        name: "description",
        content:
          "How Gapwise handles timetable, account, planning, AI, analytics, friend, community, and foreground-location data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Your schedule stays yours." date="August 30, 2026">
      <section>
        <h2>Scope</h2>
        <p>
          This notice explains the data handling of the public Gapwise application at gapwise.ca and
          its optional signed-in, social, cloud-sync, and AI features. Gapwise is an independent
          student project and is not an official University of Toronto service or a University of
          Toronto data system.
        </p>
      </section>

      <section>
        <h2>Timetables and location</h2>
        <p>
          Gapwise parses ACORN .ics timetable exports in your browser. The original file is not
          uploaded. Guest mode keeps your schedule in this browser. Parsed timetable information may
          be remembered locally when you choose that option and may enter optional encrypted sync
          after you sign in.
        </p>
        <p>
          Foreground live location is optional, starts only when you request location-aware routing,
          and is not background tracked or included in ordinary cloud sync or AI snapshots. Your
          browser and map-tile provider can still receive ordinary network metadata when those
          features are used.
        </p>
      </section>

      <section>
        <h2>Accounts and private sync</h2>
        <p>
          You may sign in with Google, Microsoft, or GitHub. Supabase provides authentication and
          stores the account identity and session information needed for signed-in features. When
          private sync is enabled, supported private state is encrypted in the browser before cloud
          storage. Supabase stores ciphertext and related account, relationship, and cryptographic
          metadata; Vercel remains inside the cryptographic trust boundary for the key-broker
          service.
        </p>
        <p>
          Gapwise therefore describes this protection as browser-side or browser-encrypted storage,
          not end-to-end encryption or zero-knowledge encryption.
        </p>
      </section>

      <section>
        <h2>Friends and community features</h2>
        <p>
          Optional friend features use account, invite, relationship, rate-limit, and deliberately
          lossy availability information needed to provide mutual common-gap results. The
          availability capsule excludes course names, rooms, buildings, activity labels, and the
          full timetable. Time-bounded crowd reports and publisher state may also be stored when
          those community features are used.
        </p>
      </section>

      <section>
        <h2>Analytics and diagnostics</h2>
        <p>
          Gapwise uses Vercel Web Analytics and Speed Insights for aggregate usage and performance
          measurements. Gapwise does not intentionally send raw timetable entries, rooms, coursework
          details, friend data, precise location, authentication tokens, or decrypted private-cloud
          payloads as analytics events. Gapwise does not contain advertising or sell personal data.
        </p>
        <p>
          The application does not add an advertising or cross-site tracking cookie layer. If the
          analytics configuration changes to use non-essential cookies or identifiable tracking,
          Gapwise must reassess notice and consent requirements before shipping that change.
        </p>
      </section>

      <section>
        <h2>AI</h2>
        <p>
          AI features are opt-in. Connecting an AI client does not automatically expose your
          timetable. You choose supported read categories and separate write permissions. A
          minimized delegated snapshot may be processed by the Gapwise AI service and, when you
          invoke an AI provider, by that provider under its own terms and privacy practices. Gapwise
          does not send friend data, precise live location, primary private-data encryption keys, or
          identity-provider tokens in the delegated snapshot.
        </p>
      </section>

      <section>
        <h2>Why data is used</h2>
        <p>
          Gapwise uses data to provide the features you request, keep signed-in and delegated access
          authorized, protect the service from abuse, restore optional private state, and understand
          aggregate reliability and performance. It does not use private timetable or location data
          for targeted advertising.
        </p>
      </section>

      <section>
        <h2>Service providers and international processing</h2>
        <p>
          Depending on the features you use, Vercel, Supabase, Google, Microsoft, GitHub,
          OpenFreeMap-related infrastructure, Gapwise AI, and an AI provider you choose may process
          technical, account, or delegated data. Those providers can process information outside
          your province or country. Exact production regions, provider retention, contractual terms,
          and legal roles can change and require provider-level verification rather than assumptions
          from source code alone.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Browser data remains until you replace it, remove it in Gapwise, or clear this site's
          data. Current cloud records generally remain until replaced or deleted, or until the
          account is deleted, subject to provider logs, backups, and other infrastructure retention
          outside the application's direct control.
        </p>
        <ul>
          <li>Use Gapwise without an account.</li>
          <li>Turn optional sync and AI permissions off.</li>
          <li>Remove a locally remembered timetable and other local planning data.</li>
          <li>Revoke an AI delegation and its Gapwise-side delegated data.</li>
          <li>Delete your account and associated Gapwise cloud records from account settings.</li>
        </ul>
        <p>
          Clearing browser data does not itself delete an existing cloud account or data already
          sent to an external AI provider. Provider-side backup and log deletion can also follow the
          provider's own retention practices.
        </p>
      </section>

      <section>
        <h2>Access, correction, and privacy requests</h2>
        <p>
          Applicable privacy rights depend on the facts and law that cover the service; simply using
          Gapwise while travelling in another country does not by itself determine which law
          applies. Where applicable, you may have rights to ask about data Gapwise holds, request
          access or correction, object or withdraw consent for optional processing, or request
          deletion or portability.
        </p>
        <p>
          Self-service deletion and feature controls are available in the product. For a request
          that cannot be completed in the product, contact the repository owner through the{" "}
          <a href="https://github.com/andrewmuratov">Gapwise GitHub profile</a> and ask for a
          private privacy-request channel. Do not place personal information or account evidence in
          a public GitHub issue. A dedicated monitored privacy contact and accountable privacy role
          are still administrative items that require owner confirmation.
        </p>
      </section>

      <section>
        <h2>Security and incidents</h2>
        <p>
          Gapwise uses access controls, row-level security, browser-side encryption for supported
          private cloud data, credential redaction in server diagnostics, and a documented incident
          response process. No security measure eliminates all risk. Suspected vulnerabilities
          should be reported through the private process on the{" "}
          <a href="/security">Security page</a>.
        </p>
        <p>
          If a privacy incident occurs, Gapwise's incident process requires scope and risk
          assessment before any notification decision. Applicable reporting, notice, recordkeeping,
          and timing duties depend on the jurisdiction and incident facts and require qualified
          review rather than a universal fixed deadline.
        </p>
      </section>

      <section>
        <h2>More detail and changes</h2>
        <p>
          The repository's{" "}
          <a href="https://github.com/andrewmuratov/gapwise/blob/main/PRIVACY.md">
            technical privacy notice
          </a>{" "}
          and{" "}
          <a href="https://github.com/andrewmuratov/gapwise/blob/main/docs/TRUST_DATA_INVENTORY.md">
            data inventory
          </a>{" "}
          document implementation details and known verification gaps. Material data-handling
          changes should be reflected in this notice before the changed behavior is promoted to
          users.
        </p>
      </section>
    </LegalPage>
  );
}
