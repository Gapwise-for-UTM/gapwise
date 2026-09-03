import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Gapwise for UTM" },
      {
        name: "description",
        content:
          "Get help with Gapwise, account access, timetable data, AI connectors, privacy, and security.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <LegalPage eyebrow="Support" title="Help with Gapwise." dateLabel="Updated" date="September 3, 2026">
      <section>
        <h2>Contact support</h2>
        <p>
          For account, timetable, campus-data, AI-connector, or general product help, email{" "}
          <a className="text-accent underline" href="mailto:support@gapwise.ca">
            support@gapwise.ca
          </a>
          . Include the feature you were using, what you expected to happen, what happened instead,
          and any non-sensitive error message you saw. Do not send passwords, access tokens,
          encryption keys, raw authentication codes, or another student&apos;s private information.
        </p>
      </section>

      <section>
        <h2>ChatGPT and Claude connectors</h2>
        <p>
          Gapwise AI is an optional connection between your Gapwise account and compatible AI
          clients. Connecting a client does not automatically expose your timetable. You must sign
          in to Gapwise, approve the OAuth client, and explicitly enable the Gapwise AI permissions
          you want to share.
        </p>
        <ul>
          <li>If connection fails, disconnect Gapwise in the AI client and connect again.</li>
          <li>
            If a tool says AI access is disabled, open Gapwise and enable the required AI delegation
            permission before retrying.
          </li>
          <li>
            If a write is rejected as stale, ask the assistant to read your latest Gapwise state and
            retry from the new revision.
          </li>
          <li>
            Academic meetings imported from ACORN are read-only to AI. Gapwise will reject attempts
            to create, edit, or delete them through an AI connector.
          </li>
          <li>
            To revoke access, disconnect the client and revoke Gapwise AI access in Gapwise. Revoked
            credentials no longer authorize private Gapwise AI tools.
          </li>
        </ul>
        <p>
          Technical MCP documentation is available at{" "}
          <a href="https://docs.gapwise.ca">docs.gapwise.ca</a>, and service health is published at{" "}
          <a href="https://status.gapwise.ca">status.gapwise.ca</a>.
        </p>
      </section>

      <section>
        <h2>Timetable and planning help</h2>
        <ul>
          <li>
            If an imported class is missing or incorrect, re-export the current ACORN calendar and
            import it again rather than manually changing the source-backed meeting.
          </li>
          <li>
            Gapwise distinguishes raw free time from usable gap time. Routing, transition buffers,
            setup and pack-up time, and uncertainty can reduce the usable activity window.
          </li>
          <li>
            When Gapwise marks a route or gap as approximate or unavailable, an AI client should
            preserve that uncertainty instead of inventing a precise answer.
          </li>
        </ul>
      </section>

      <section>
        <h2>Privacy requests</h2>
        <p>
          For questions about access, correction, deletion, portability, restriction, objection, or
          Gapwise&apos;s handling of personal information, email{" "}
          <a className="text-accent underline" href="mailto:support@gapwise.ca">
            support@gapwise.ca
          </a>{" "}
          and review the <a href="/privacy">Privacy Notice</a>. Gapwise may need to verify that a
          requester controls the relevant account before disclosing or changing private data.
        </p>
      </section>

      <section>
        <h2>Security reports</h2>
        <p>
          Suspected vulnerabilities should be reported privately to{" "}
          <a className="text-accent underline" href="mailto:security@gapwise.ca">
            security@gapwise.ca
          </a>
          . Do not publish proof-of-concept details or test against another user&apos;s account. The
          project&apos;s security policy and private-reporting expectations are also documented in the
          public Gapwise repositories.
        </p>
      </section>

      <section>
        <h2>Open-source issue tracker</h2>
        <p>
          Reproducible non-security bugs and feature requests may also be filed on the public{" "}
          <a href="https://github.com/andrewmuratov/gapwise/issues">Gapwise issue tracker</a>. Never
          include private timetable data, credentials, OAuth tokens, or security-sensitive details
          in a public issue.
        </p>
      </section>

      <section>
        <h2>Service relationship</h2>
        <p>
          Gapwise is an independent student project. It is not an official University of Toronto
          service and is not affiliated with or endorsed by the University of Toronto, OpenAI, or
          Anthropic. Availability of a Gapwise integration in a third-party directory does not imply
          endorsement by that provider.
        </p>
      </section>
    </LegalPage>
  );
}
