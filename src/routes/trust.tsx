import { Link, createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust Center — Gapwise for UTM" },
      {
        name: "description",
        content:
          "Evidence-backed privacy, security, accessibility, data-flow, campus-routing, AI permission, incident-response, and independence information for Gapwise.",
      },
    ],
  }),
  component: TrustPage,
});

const cardClass =
  "block rounded-2xl border border-border bg-card/40 p-5 transition-colors hover:border-accent/40 hover:bg-card/70";

function TrustPage() {
  return (
    <LegalPage
      eyebrow="Trust Center"
      title="Evidence before promises."
      dateLabel="Last reviewed"
      date="September 3, 2026"
    >
      <section>
        <p>
          Gapwise is an independent student project for UTM. It is not an official University of
          Toronto service and does not claim university review, sponsorship, endorsement,
          certification, or procurement approval. This page separates implementation-backed facts
          from operating commitments and items that still require provider, legal, or human
          confirmation.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link to="/privacy" className={cardClass}>
            <strong className="block text-foreground">Privacy & data use</strong>
            <span className="mt-1 block">
              Timetables, accounts, location, analytics, and controls.
            </span>
          </Link>
          <Link to="/security" className={cardClass}>
            <strong className="block text-foreground">Security reporting</strong>
            <span className="mt-1 block">
              Vulnerability disclosure and the private report path.
            </span>
          </Link>
          <Link to="/accessibility" className={cardClass}>
            <strong className="block text-foreground">Accessibility</strong>
            <span className="mt-1 block">
              Current evidence, targets, limitations, and feedback.
            </span>
          </Link>
          <a href="https://docs.gapwise.ca/platform/security/" className={cardClass}>
            <strong className="block text-foreground">Security architecture</strong>
            <span className="mt-1 block">Trust boundaries, data flows, and validation limits.</span>
          </a>
          <a href="https://status.gapwise.ca/" className={cardClass}>
            <strong className="block text-foreground">Service status</strong>
            <span className="mt-1 block">
              Current operational status and incident-reporting information.
            </span>
          </a>
          <a href="https://data.gapwise.ca/" className={cardClass}>
            <strong className="block text-foreground">Campus data & provenance</strong>
            <span className="mt-1 block">
              Inspect the source-backed campus data layer, schemas, and uncertainty boundaries.
            </span>
          </a>
        </div>
      </section>

      <section>
        <h2>Contact Gapwise</h2>
        <p>
          Use the channel that matches the issue so operational questions and security reports do
          not get mixed together.
        </p>
        <ul>
          <li>
            General help, privacy questions, account support, bug reports, and product questions:{" "}
            <a className="text-accent underline" href="mailto:support@gapwise.ca">
              support@gapwise.ca
            </a>
          </li>
          <li>
            Suspected vulnerabilities, exposed secrets, authentication or authorization issues, and
            other security-sensitive reports:{" "}
            <a className="text-accent underline" href="mailto:security@gapwise.ca">
              security@gapwise.ca
            </a>
          </li>
        </ul>
        <p>
          Security reports should not be posted in public GitHub issues. The dedicated vulnerability
          disclosure page also links to GitHub private vulnerability reporting when available.
        </p>
      </section>

      <section>
        <h2>Your ACORN timetable</h2>
        <ul>
          <li>Gapwise does not ask for your ACORN password.</li>
          <li>The original ACORN .ics file is read and parsed in your browser.</li>
          <li>The application does not upload the original file or its source filename.</li>
          <li>Guest timetable, gap, and route planning can work without a Gapwise account.</li>
        </ul>
        <p>
          If you choose to remember a timetable locally, parsed schedule data can remain in browser
          storage. If you enable private cloud sync, supported private state can also enter the
          encrypted sync flow described below.
        </p>
      </section>

      <section>
        <h2>Accounts and private cloud</h2>
        <p>
          Sign-in is optional and currently uses Supabase Auth with Google, Microsoft, or GitHub as
          user-selected identity providers. Supported private cloud state is encrypted in the
          browser before Supabase storage. Vercel remains inside the cryptographic trust boundary
          because the server-side key broker unwraps and re-wraps data keys with a server-held key.
        </p>
        <p>
          For that reason, Gapwise describes this design as <strong>browser-encrypted</strong> or
          <strong> browser-side encrypted</strong>. It does not call the design end-to-end encrypted
          or zero knowledge. Account settings include an account-and-cloud-data deletion flow;
          provider backups, logs, retention, and production configuration are separate evidence
          questions and are not inferred from source code.
        </p>
      </section>

      <section>
        <h2>Campus routes and walking-time estimates</h2>
        <p>
          Gapwise computes deterministic UTM building-to-building routes from the project&apos;s
          maintained campus model. Building identity, route evidence, accessibility evidence, and
          confidence are kept separate so an unknown or approximate route is not silently presented
          as verified.
        </p>
        <p>
          Walking times are planning estimates, not guarantees. Actual travel time can vary with
          walking speed, accessibility needs, entrances, elevators, congestion, construction,
          temporary closures, weather, and route choice. Step-free routing fails closed when the
          available evidence is insufficient to support a verified accessible route.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/places" className="text-accent hover:underline">
            Campus places
          </Link>
          <a href="https://data.gapwise.ca/" className="text-accent hover:underline">
            Data provenance
          </a>
          <a
            href="https://docs.gapwise.ca/platform/routing/"
            className="text-accent hover:underline"
          >
            Routing documentation
          </a>
        </div>
      </section>

      <section>
        <h2>Public API, private account state, and AI are separate boundaries</h2>
        <p>
          The public developer API is for deterministic campus information. It does not expose
          private student timetables, accounts, friends, private sync state, credentials, or precise
          live location. Private AI access is a separate opt-in delegation path.
        </p>
        <p>
          In the current core delegation contract, users select readable categories and separate
          write permissions. Core excludes friend data, personal-item notes, precise live location,
          primary encryption keys, and identity-provider or OAuth tokens from delegated snapshots.
          Academic timetable meetings are not an AI write target; typed writes are bounded to
          supported personal planning actions and preferences.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/developers" className="text-accent hover:underline">
            Developer hub
          </Link>
          <a href="https://docs.gapwise.ca/ai/permissions/" className="text-accent hover:underline">
            AI permission documentation
          </a>
          <a
            href="https://docs.gapwise.ca/platform/architecture/"
            className="text-accent hover:underline"
          >
            Architecture and data flow
          </a>
        </div>
      </section>

      <section>
        <h2>Third parties and data residency</h2>
        <p>
          Current source shows Vercel for application/API hosting and aggregate product telemetry,
          Supabase for authentication and optional account/cloud storage, optional Google,
          Microsoft, and GitHub identity providers, OpenFreeMap for browser map requests, Cloudflare
          for DNS, inbound Gapwise email routing, and Turnstile, Resend for configured transactional
          authentication email, and the optional Gapwise AI boundary when a user enables it. Source
          data attribution is not the same thing as a runtime processor.
        </p>
        <p>
          Exact provider regions, contractual roles, subprocessor chains, backup/log retention, and
          some production dashboard settings require current provider or human evidence. The
          maintained inventory records those unknowns instead of guessing them.
        </p>
        <a
          href="https://github.com/andrewmuratov/gapwise/blob/main/docs/TRUST_DATA_INVENTORY.md"
          className="text-accent hover:underline"
        >
          Data and trust inventory
        </a>
      </section>

      <section>
        <h2>Analytics and tracking</h2>
        <p>
          Gapwise uses Vercel Web Analytics and Speed Insights for aggregate operational and
          performance measurements. The project does not intentionally send raw timetable entries,
          room details, friend data, authentication tokens, or precise live location as analytics
          events. Hosting and provider logs can still contain technical network metadata, so Gapwise
          does not describe the deployed service as producing no telemetry at all.
        </p>
      </section>

      <section>
        <h2>Retention, deletion, and privacy governance</h2>
        <p>
          Gapwise exposes browser controls for remembered data and application controls for account
          and cloud-data deletion. Source-defined deletion behavior is documented separately from
          provider backup and log retention, which must be confirmed from the relevant service.
          Internal privacy-governance material includes retention/deletion, data-rights, feature
          change, third-party review, and privacy-incident workflows; draft legal language remains
          subject to human or legal approval where marked.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/privacy" className="text-accent hover:underline">
            Privacy page
          </Link>
          <a
            href="https://github.com/andrewmuratov/gapwise-docs/tree/main/governance/privacy"
            className="text-accent hover:underline"
          >
            Privacy governance package
          </a>
        </div>
      </section>

      <section>
        <h2>Vulnerability and incident handling</h2>
        <p>
          Gapwise publishes a vulnerability disclosure policy and canonical security.txt. The
          incident-response runbook separates verified evidence, process commitments, and
          confirmation-required facts; it covers severity, containment, provider escalation, privacy
          triage, notification decisions, recovery, and public postmortem preparation.
        </p>
        <p>
          Gapwise publishes a dedicated public service-status surface at status.gapwise.ca. It
          reports current operational state and provides incident-reporting paths, but it does not
          claim an uptime percentage, response-time SLA, RTO, RPO, or historical incident statistic
          without measured evidence.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/security" className="text-accent hover:underline">
            Report a vulnerability
          </Link>
          <a href="https://status.gapwise.ca/" className="text-accent hover:underline">
            Service status
          </a>
          <a
            href="https://github.com/andrewmuratov/gapwise/blob/main/docs/INCIDENT_RESPONSE.md"
            className="text-accent hover:underline"
          >
            Incident-response runbook
          </a>
        </div>
      </section>

      <section>
        <h2>Accessibility evidence</h2>
        <p>
          WCAG 2.2 Level AA is a product and review target, not a blanket conformance claim.
          Maintained browser tests use axe-core on selected states and exercise representative
          keyboard, focus-restoration, semantic-state, theme, and reduced-motion behavior. No
          repeatable manual screen-reader pass or third-party accessibility certification is
          currently claimed.
        </p>
        <Link to="/accessibility" className="text-accent hover:underline">
          Accessibility Statement
        </Link>
      </section>

      <section>
        <h2>Policies, change history, and independent review</h2>
        <p>
          Gapwise does not claim SOC 2, ISO 27001, an independent penetration test, VPAT
          certification, or another audit/certification unless a future assessment actually occurs
          and its scope and result are verified. Transparency templates likewise prohibit turning
          missing measurements into zero.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/terms" className="text-accent hover:underline">
            Terms
          </Link>
          <a
            href="https://docs.gapwise.ca/platform/changelog/"
            className="text-accent hover:underline"
          >
            Developer-platform changelog
          </a>
          <a
            href="https://github.com/andrewmuratov/gapwise/commits/main"
            className="text-accent hover:underline"
          >
            Source history
          </a>
        </div>
      </section>

      <section>
        <h2>What still needs human or independent evidence</h2>
        <ul>
          <li>
            Provider contract, residency, backup, log-retention, and production-dashboard facts.
          </li>
          <li>Formal legal, tax, insurance, trademark, procurement, or university decisions.</li>
          <li>An independent penetration test or certification, if one is commissioned later.</li>
          <li>Manual assistive-technology evaluation needed for stronger accessibility claims.</li>
          <li>
            Measured operational statistics before any uptime, incident, or transparency number is
            published.
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
