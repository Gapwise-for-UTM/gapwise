import { Link, createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Gapwise AI — Connect Gapwise to AI assistants" },
      {
        name: "description",
        content:
          "Connect explicitly delegated Gapwise timetable and UTM campus intelligence to compatible AI assistants through Gapwise's secure remote MCP service.",
      },
    ],
  }),
  component: AiPage,
});

const cardClass =
  "rounded-2xl border border-border bg-card/40 p-5";

function AiPage() {
  return (
    <LegalPage eyebrow="Gapwise AI" title="Your Gapwise context, with an assistant you choose.">
      <section>
        <p>
          Gapwise AI is the permissioned integration layer that lets compatible AI assistants ask
          Gapwise for deterministic timetable and UTM campus information. Gapwise remains the source
          of schedule, route, and gap facts; the connected assistant supplies natural-language
          reasoning.
        </p>
        <p>
          The production remote MCP endpoint is{" "}
          <code>https://ai.gapwise.ca/api/mcp</code>. You should never need to paste your Gapwise
          access token into an AI client.
        </p>
      </section>

      <section>
        <h2>What an assistant can help with</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={cardClass}>
            <strong className="block text-foreground">Understand your day or week</strong>
            <span className="mt-1 block">Read only the timetable and personal context you explicitly delegated.</span>
          </div>
          <div className={cardClass}>
            <strong className="block text-foreground">Find realistic free time</strong>
            <span className="mt-1 block">Use Gapwise availability and gap calculations instead of model-side timetable arithmetic.</span>
          </div>
          <div className={cardClass}>
            <strong className="block text-foreground">Navigate UTM</strong>
            <span className="mt-1 block">Reason over Gapwise building, routing, accessibility, and gap-planning facts.</span>
          </div>
          <div className={cardClass}>
            <strong className="block text-foreground">Manage personal planning</strong>
            <span className="mt-1 block">When you allow writes, queue bounded personal-item and selected preference changes.</span>
          </div>
        </div>
      </section>

      <section>
        <h2>What AI never gets from the connector</h2>
        <ul>
          <li>Your raw ACORN .ics file.</li>
          <li>Your account password or identity-provider credentials.</li>
          <li>Supabase refresh tokens or Gapwise private-data encryption keys.</li>
          <li>Friend identities, friend availability, or overlap data.</li>
          <li>Precise live or background location.</li>
          <li>Unrelated browser/private state.</li>
        </ul>
      </section>

      <section>
        <h2>Academic meetings are always read-only</h2>
        <p>
          AI integrations cannot create, edit, or delete imported/source-backed academic meetings.
          Supported writes are limited to explicitly delegated personal timetable items and selected
          planning preferences, and those writes are permission-checked, typed, revision-bound, and
          queued for Gapwise to apply.
        </p>
      </section>

      <section>
        <h2>Connect</h2>
        <p>
          When a supported AI client connects, Gapwise uses OAuth and shows its normal consent flow.
          You choose whether AI delegation is enabled and which supported read/write categories are
          shared. The connector receives only what those permissions allow.
        </p>
        <p>
          Public directory availability for individual AI platforms is announced only after that
          exact client has passed Gapwise&apos;s production OAuth/read/write/revocation validation and
          the platform has approved the listing.
        </p>
      </section>

      <section>
        <h2>Example questions</h2>
        <ul>
          <li>“What does my day look like tomorrow?”</li>
          <li>“Find me a 90-minute study opportunity this week.”</li>
          <li>“What is the best use of my gap after class on Tuesday?”</li>
          <li>“Can I fit a gym session from 3 to 4 PM Wednesday?”</li>
          <li>“How do I get from MN to DH at UTM?”</li>
        </ul>
      </section>

      <section>
        <h2>Revoke access at any time</h2>
        <p>
          Disable/revoke the AI connection from Gapwise to remove delegated connector state and
          queued actions. Subsequent private connector reads and writes fail until you explicitly
          authorize again. The external AI provider&apos;s own account, conversation, and retention
          settings remain governed by that provider.
        </p>
      </section>

      <section>
        <h2>Privacy, terms, and support</h2>
        <div className="flex flex-wrap gap-4">
          <Link to="/privacy" className="text-accent underline">Privacy</Link>
          <Link to="/terms" className="text-accent underline">Terms</Link>
          <Link to="/support" className="text-accent underline">Support</Link>
          <Link to="/trust" className="text-accent underline">Trust Center</Link>
          <a href="https://docs.gapwise.ca/ai/permissions/" className="text-accent underline">
            AI permissions documentation
          </a>
        </div>
      </section>

      <section>
        <h2>Independent project</h2>
        <p>
          Gapwise is an independent project and is not an official University of Toronto service.
          Availability in an AI platform directory means the integration is available there; it does
          not imply endorsement by the University, OpenAI, Anthropic, or another platform.
        </p>
      </section>
    </LegalPage>
  );
}
