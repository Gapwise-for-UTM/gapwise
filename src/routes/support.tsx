import { Link, createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Gapwise for UTM" },
      {
        name: "description",
        content:
          "Support for Gapwise accounts, timetables, AI connectors, privacy, security, and troubleshooting.",
      },
    ],
  }),
  component: SupportPage,
});

const cardClass =
  "block rounded-2xl border border-border bg-card/40 p-5 transition-colors hover:border-accent/40 hover:bg-card/70";

function SupportPage() {
  return (
    <LegalPage eyebrow="Support" title="Help with Gapwise.">
      <section>
        <p>
          For ordinary product or account help, email{" "}
          <a className="text-accent underline" href="mailto:support@gapwise.ca">
            support@gapwise.ca
          </a>
          . Do not send passwords, OAuth codes, bearer tokens, encryption keys, or another
          student&apos;s private information.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link to="/ai" className={cardClass}>
            <strong className="block text-foreground">AI connectors</strong>
            <span className="mt-1 block">Connect, authorize, revoke, and troubleshoot Gapwise AI access.</span>
          </Link>
          <Link to="/privacy" className={cardClass}>
            <strong className="block text-foreground">Privacy & data</strong>
            <span className="mt-1 block">What Gapwise processes and the controls available to you.</span>
          </Link>
          <Link to="/security" className={cardClass}>
            <strong className="block text-foreground">Security reporting</strong>
            <span className="mt-1 block">Private vulnerability-reporting instructions.</span>
          </Link>
          <a href="https://status.gapwise.ca/" className={cardClass}>
            <strong className="block text-foreground">Service status</strong>
            <span className="mt-1 block">Check whether a current service issue may explain a failure.</span>
          </a>
        </div>
      </section>

      <section>
        <h2>AI connector will not connect</h2>
        <ol>
          <li>Make sure you are signed in to Gapwise.</li>
          <li>Open Gapwise AI settings and enable AI delegation.</li>
          <li>Complete the Gapwise consent screen shown by the AI client.</li>
          <li>Approve only the permissions you actually want to delegate.</li>
          <li>If access was previously revoked, reconnect and authorize the client again.</li>
        </ol>
        <p>
          The canonical remote MCP service is{" "}
          <code>https://ai.gapwise.ca/api/mcp</code>. Supported clients should discover the OAuth
          requirements from that service rather than asking you to paste an access token.
        </p>
      </section>

      <section>
        <h2>Schedule information is missing</h2>
        <p>
          Confirm that the timetable is present and current inside Gapwise and that the relevant AI
          read permission is enabled. Gapwise intentionally does not invent classes, rooms, routes,
          free time, or gap assessments that are absent from its source-backed state.
        </p>
      </section>

      <section>
        <h2>An AI-requested change was rejected</h2>
        <p>
          Personal-item and supported preference writes are permission-checked and revision-bound.
          A stale or conflicting write can fail even if the assistant expected it to work. Refresh
          the current Gapwise context and retry only if the request still fits. Imported academic
          meetings cannot be created, edited, or deleted through AI integrations.
        </p>
      </section>

      <section>
        <h2>Disconnect or revoke AI access</h2>
        <p>
          Revoke the connector from Gapwise AI settings. Revocation removes the delegated Gapwise AI
          snapshot and queued bridge actions and prevents subsequent private connector reads or
          writes until you explicitly authorize again. You may also use the connected provider&apos;s
          own connector-management controls.
        </p>
      </section>

      <section>
        <h2>Security concerns</h2>
        <p>
          Do not publish vulnerability details in a public issue. Follow the private reporting path
          on the{" "}
          <Link to="/security" className="text-accent underline">
            Security page
          </Link>{" "}
          or email{" "}
          <a className="text-accent underline" href="mailto:security@gapwise.ca">
            security@gapwise.ca
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Technical bug reports</h2>
        <p>
          Reproducible, non-sensitive technical issues may also be reported through the appropriate
          public Gapwise GitHub repository. Remove account data, timetable details, tokens, and
          security-sensitive reproduction information before posting publicly.
        </p>
        <a
          className="text-accent underline"
          href="https://github.com/andrewmuratov/gapwise/issues"
        >
          Gapwise issues
        </a>
      </section>

      <section>
        <h2>Project status</h2>
        <p>
          Gapwise is an independent student project and is not an official University of Toronto
          service. Support information does not imply University, OpenAI, or Anthropic endorsement.
        </p>
      </section>
    </LegalPage>
  );
}
