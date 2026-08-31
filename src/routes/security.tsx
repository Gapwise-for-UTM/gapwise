import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const PRIVATE_REPORT_URL = "https://github.com/andrewmuratov/gapwise/security/advisories/new";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Vulnerability Disclosure — Gapwise for UTM" },
      {
        name: "description",
        content: "How to report a suspected Gapwise security vulnerability privately and safely.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="Vulnerability Disclosure Policy"
      dateLabel="Last reviewed"
      date="September 1, 2026"
    >
      <section>
        <h2>Report privately</h2>
        <p>
          Email{" "}
          <a className="text-accent underline" href="mailto:security@gapwise.ca">
            security@gapwise.ca
          </a>{" "}
          or use the repository&apos;s{" "}
          <a className="text-accent underline" href={PRIVATE_REPORT_URL}>
            private vulnerability reporting form
          </a>
          . Do not put vulnerability details, credentials, tokens, private student data, or key
          material in a public issue or pull request.
        </p>
      </section>

      <section>
        <h2>Scope</h2>
        <p>
          Reports about the current production service at gapwise.ca and code in the
          repository&apos;s main branch are in scope. Reports are most useful when they identify the
          affected URL or component, explain impact, and provide reproducible steps using accounts
          and non-sensitive data you control.
        </p>
      </section>

      <section>
        <h2>Good-faith research</h2>
        <ul>
          <li>Make a reasonable effort to avoid privacy violations and service disruption.</li>
          <li>Use the minimum testing necessary to confirm and describe the issue.</li>
          <li>Stop and report promptly if you encounter data that is not yours.</li>
          <li>Delete data obtained unintentionally and keep report details confidential.</li>
          <li>Comply with applicable law and do not use a finding for extortion.</li>
        </ul>
        <p>
          This policy does not currently make a legal safe-harbour promise. Any future safe-harbour
          language requires human and legal review before publication.
        </p>
      </section>

      <section>
        <h2>Do not test these ways</h2>
        <ul>
          <li>Do not access or alter another person&apos;s account or data.</li>
          <li>Do not perform denial-of-service, load, stress, or availability testing.</li>
          <li>Do not use social engineering, phishing, malware, or physical attacks.</li>
          <li>Do not scan third-party providers or systems that Gapwise does not control.</li>
          <li>Do not exfiltrate secrets or retain data beyond the minimum proof required.</li>
          <li>Do not degrade production or automated operations.</li>
        </ul>
      </section>

      <section>
        <h2>Coordination and operational goals</h2>
        <p>
          Gapwise aims to acknowledge a report within 7 calendar days and provide an initial triage
          update within 14 calendar days. These are operational goals, not guaranteed response or
          remediation SLAs. Timing depends on severity, complexity, and maintainer availability.
        </p>
        <p>
          Please allow a reasonable remediation period and coordinate before public disclosure.
          Gapwise will aim to keep reporters informed and, with permission, credit helpful reports.
          Gapwise does not currently operate a bug-bounty or paid-reward program.
        </p>
      </section>

      <section>
        <h2>Security boundary</h2>
        <p>
          Optional private cloud state uses browser-side application-layer encryption. The key
          broker remains inside the trust boundary because it can unwrap per-user data-encryption
          keys. Gapwise does not describe this design as end-to-end encrypted or zero knowledge.
        </p>
      </section>
    </LegalPage>
  );
}
