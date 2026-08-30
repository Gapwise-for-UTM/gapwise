import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Gapwise for UTM" },
      {
        name: "description",
        content: "How Gapwise handles timetable, account, planning, AI, and location data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Your schedule stays yours.">
      <section>
        <h2>Scope and who operates Gapwise</h2>
        <p>
          This notice describes the hosted Gapwise application at gapwise.ca. Gapwise is an
          independent student project, not an official University of Toronto service. The project
          operator determines how the hosted service processes account and application data. For
          privacy questions or requests, use the contact method published on the Gapwise repository
          or security page. A qualified legal review is still required to confirm the operator's
          formal controller identity, mailing address, and any jurisdiction-specific representative
          requirements before making broader compliance claims.
        </p>
      </section>
      <section>
        <h2>Timetables and location</h2>
        <p>
          Gapwise parses ACORN .ics timetable exports in your browser. The original file is not
          uploaded. Guest mode keeps your schedule in this browser. Foreground live location is
          optional, used only while you ask for it, and is not background tracked or retained as a
          route history by ordinary private sync.
        </p>
      </section>
      <section>
        <h2>Accounts and private sync</h2>
        <p>
          You may sign in with Google, Microsoft, or GitHub. Supabase provides authentication and
          stores the account identity returned by that provider. When private sync is enabled,
          supported private state is encrypted in the browser before cloud storage. Supabase stores
          ciphertext, cryptographic metadata, and the account and relationship metadata required to
          provide the feature. Vercel is inside the cryptographic trust boundary for key-broker
          operations, so Gapwise does not describe this design as zero-knowledge or end-to-end
          encryption.
        </p>
      </section>
      <section>
        <h2>Why data is processed</h2>
        <p>
          Account and session data is processed to authenticate you and provide requested signed-in
          features. Encrypted sync and friend data is processed to provide features you choose to
          enable. Security and limited operational data may be processed to protect, diagnose, and
          operate the service. Optional AI delegation is processed only after you enable it and
          select supported permissions. The precise legal basis that applies can depend on the user,
          jurisdiction, and feature; Gapwise does not claim that a single checkbox or consent label
          resolves every legal basis requirement.
        </p>
      </section>
      <section>
        <h2>Service providers and transfers</h2>
        <p>
          Gapwise relies on Vercel for hosting and operational measurements, Supabase for
          authentication and cloud data, OpenFreeMap for map style and tile delivery, and the
          identity provider you select for sign-in. Opening a map can therefore create a direct
          browser request to OpenFreeMap even though Gapwise does not send your private timetable
          payload to the map provider. If you connect an external AI provider, authorized tool
          output is also sent to that provider. These providers may process technical or account
          information in countries outside your own. Their own terms, locations, safeguards, and
          retention practices can apply. Gapwise does not claim a particular international-transfer
          mechanism here without provider and legal verification.
        </p>
      </section>
      <section>
        <h2>Analytics, cookies, and local storage</h2>
        <p>
          Gapwise uses Vercel Web Analytics and Speed Insights for aggregate operational and
          performance measurements. Vercel currently describes Web Analytics as cookie-free and
          anonymized, but ordinary hosting and provider logs can still contain technical network
          metadata. Gapwise does not intentionally send raw timetable entries, rooms, coursework
          details, friend data, authentication tokens, or precise location as analytics events.
          Gapwise also uses browser storage needed for guest data, preferences, sessions, encrypted
          records, and device keys. Gapwise does not add a consent banner merely for appearance; if
          non-essential tracking or advertising technology is introduced, its consent requirements
          must be reassessed before deployment.
        </p>
      </section>
      <section>
        <h2>AI</h2>
        <p>
          AI features are opt-in and disclose the specific schedule and planning categories they may
          use. Connecting an AI client does not by itself expose the primary encrypted timetable.
          When you authorize and invoke an external AI provider, that provider may process the tool
          data it receives under its own terms, account settings, and retention practices. Revoking
          Gapwise AI removes the delegated Gapwise snapshot and queued bridge actions; it cannot
          erase copies an external provider is independently required or permitted to retain.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>
          Application cloud data generally remains until it is replaced, explicitly deleted, or the
          account is deleted. Infrastructure logs and backups may follow provider retention cycles
          and are not necessarily erased from every backup immediately. Account deletion removes the
          Supabase authentication account and user-owned application records through the service's
          deletion path. Browser copies are separate and can be removed in Gapwise where offered or
          through your browser's site-data controls.
        </p>
      </section>
      <section>
        <h2>Your controls and privacy requests</h2>
        <ul>
          <li>Use Gapwise without an account.</li>
          <li>Turn optional sync and AI permissions off or revoke them.</li>
          <li>Remove a locally remembered timetable.</li>
          <li>Delete your account and associated application cloud data from the account menu.</li>
          <li>
            Ask about access, correction, deletion, restriction, objection, or portability where
            applicable.
          </li>
        </ul>
        <p>
          Some rights depend on the law that applies to the request. Gapwise may need to verify the
          requester before disclosing or changing account data. Where applicable, you may also have
          the right to complain to a privacy or data-protection regulator in your jurisdiction.
        </p>
      </section>
      <section>
        <h2>Security incidents</h2>
        <p>
          Gapwise maintains an incident-response process and a security-reporting channel. A privacy
          incident is assessed against the notification and recordkeeping rules that actually apply;
          not every incident has the same reporting threshold. Security reports should use the
          instructions on the Gapwise security page rather than placing secrets or personal data in
          a public issue.
        </p>
      </section>
      <section>
        <h2>Changes to this notice</h2>
        <p>
          This notice is updated when material data handling changes. Material new uses or providers
          should be assessed and reflected here before they are promoted to users. Last materially
          reviewed: August 30, 2026.
        </p>
      </section>
    </LegalPage>
  );
}
