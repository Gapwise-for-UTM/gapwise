import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bot,
  BookOpenText,
  Database,
  Route,
  ServerCog,
} from "lucide-react";
import type { ComponentProps } from "react";
import { UploadPanel } from "@/components/UploadPanel";
import "./marketing-landing.css";

type UploadProps = Pick<
  ComponentProps<typeof UploadPanel>,
  | "onFile"
  | "onDemo"
  | "loading"
  | "error"
  | "remember"
  | "onRememberChange"
  | "rememberAvailable"
>;

type MarketingLandingProps = UploadProps & {
  isOnline: boolean;
};

const PRODUCTS = [
  { id: "gapwise", label: "Gapwise" },
  { id: "gapwise-ai", label: "AI" },
  { id: "gapwise-docs", label: "Docs" },
  { id: "gapwise-data", label: "Data" },
  { id: "gapwise-status", label: "Status" },
] as const;

function ProductHeading({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="product-story-copy">
      <p className="product-story-label">
        <img src="/logo-mark.svg" alt="" aria-hidden="true" />
        {label}
      </p>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function ExternalProductLink({ href, children }: { href: string; children: string }) {
  return (
    <a className="product-story-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export function MarketingLanding({
  isOnline,
  onFile,
  onDemo,
  loading,
  error,
  remember,
  onRememberChange,
  rememberAvailable,
}: MarketingLandingProps) {
  return (
    <div className="marketing-home">
      <section className="marketing-hero" aria-labelledby="marketing-title">
        <div className="marketing-hero-copy">
          <p className="marketing-eyebrow">Gapwise for UTM</p>
          <h1 id="marketing-title">
            Make every <span>gap</span> on campus count.
          </h1>
          <p className="marketing-lede">
            One precise workspace for your timetable, the time between classes, and moving across
            UTM.
          </p>
          <div className="marketing-hero-links">
            <a href="#gapwise">Explore Gapwise</a>
            <Link to="/developers">Developers</Link>
          </div>
        </div>

        <div className="marketing-import" aria-label="Start with your timetable">
          {!isOnline ? (
            <p className="marketing-offline" role="status">
              Offline mode — timetable import and saved schedules still work.
            </p>
          ) : null}
          <UploadPanel
            variant="hero"
            onFile={onFile}
            onDemo={onDemo}
            loading={loading}
            error={error}
            remember={remember}
            onRememberChange={onRememberChange}
            rememberAvailable={rememberAvailable}
          />
        </div>
      </section>

      <nav className="product-story-nav" aria-label="Gapwise products">
        <span>Products</span>
        <div>
          {PRODUCTS.map((product) => (
            <a key={product.id} href={`#${product.id}`}>
              {product.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="product-story">
        <article id="gapwise" className="product-story-section product-story-core">
          <div>
            <ProductHeading
              label="Gapwise"
              title="Plan the time between classes."
              body="Your weekly timetable, gap plan, and campus movement share one schedule context, so every view stays focused on what comes next."
            />
            <div className="product-story-actions">
              <Link className="product-story-link" to="/utm-timetable">
                Timetable
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link className="product-story-link" to="/gap-planner">
                Gap planner
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="product-stage timetable-stage" aria-label="Gapwise timetable preview">
            <div className="stage-toolbar">
              <span>Monday</span>
              <span>Fall</span>
            </div>
            <div className="timeline-row">
              <time>09:00</time>
              <div className="timeline-line" />
              <div className="timeline-event">
                <strong>Class</strong>
                <span>MN</span>
              </div>
            </div>
            <div className="timeline-row timeline-gap">
              <time>11:00</time>
              <div className="timeline-line" />
              <div className="timeline-event">
                <strong>2h gap</strong>
                <span>Plan · route · focus</span>
              </div>
            </div>
            <div className="timeline-row">
              <time>13:00</time>
              <div className="timeline-line" />
              <div className="timeline-event">
                <strong>Class</strong>
                <span>IB</span>
              </div>
            </div>
            <div className="stage-route">
              <Route className="h-4 w-4" aria-hidden="true" />
              <span>Schedule context flows into Gap Plan and Day Route</span>
            </div>
          </div>
        </article>

        <article id="gapwise-ai" className="product-story-section product-story-ai">
          <div>
            <ProductHeading
              label="Gapwise AI"
              title="Campus context, permissioned."
              body="The Gapwise MCP layer exposes deterministic public campus intelligence plus student context you explicitly delegate. Your connected AI client supplies the reasoning."
            />
            <div className="product-story-actions">
              <Link className="product-story-link" to="/ai">
                Gapwise AI
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <ExternalProductLink href="https://ai.gapwise.ca/api/mcp">
                MCP endpoint
              </ExternalProductLink>
            </div>
          </div>

          <div className="product-stage ai-stage" aria-label="Gapwise AI tool preview">
            <div className="ai-command">
              <Bot className="h-4 w-4" aria-hidden="true" />
              <span>Use Gapwise context</span>
              <kbd>MCP</kbd>
            </div>
            <div className="ai-tool-grid">
              <span>Campus route</span>
              <span>Gap plan</span>
              <span>My day</span>
              <span>Academic work</span>
            </div>
            <div className="ai-response-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>Public campus tools and delegated private tools stay separate.</p>
          </div>
        </article>

        <article id="gapwise-docs" className="product-story-section product-story-docs">
          <div>
            <ProductHeading
              label="Gapwise Docs"
              title="Contracts you can build against."
              body="Canonical OpenAPI, JavaScript and Python SDK references, platform guides, security boundaries, and AI integration documentation live in one technical surface."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://docs.gapwise.ca">Open Docs</ExternalProductLink>
              <Link className="product-story-link" to="/developers">
                Developer platform
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="product-stage docs-stage" aria-label="Gapwise Docs preview">
            <div className="docs-sidebar">
              <BookOpenText className="h-4 w-4" aria-hidden="true" />
              <strong>Platform</strong>
              <span>API</span>
              <span>JavaScript</span>
              <span>Python</span>
              <span>AI / MCP</span>
            </div>
            <pre>
              <code>{`const gapwise = new GapwiseClient()\n\nawait gapwise.routes.create({\n  from: "MN",\n  to: "IB"\n})`}</code>
            </pre>
          </div>
        </article>

        <article id="gapwise-data" className="product-story-section product-story-data">
          <div>
            <ProductHeading
              label="Gapwise Data"
              title="UTM facts with provenance."
              body="The open data layer owns canonical campus identity, geometry, entrances, routing inputs, provenance, and validation — including 30 UTM buildings and facilities in the published snapshot."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://data.gapwise.ca">Explore Data</ExternalProductLink>
            </div>
          </div>

          <div className="product-stage data-stage" aria-label="Gapwise Data preview">
            <div className="data-stage-header">
              <Database className="h-4 w-4" aria-hidden="true" />
              <span>Campus registry</span>
              <strong>30</strong>
            </div>
            <div className="data-table" role="presentation">
              <div>
                <strong>MN</strong>
                <span>Geometry</span>
                <span>Entrances</span>
                <i />
              </div>
              <div>
                <strong>IB</strong>
                <span>Geometry</span>
                <span>Routing</span>
                <i />
              </div>
              <div>
                <strong>DH</strong>
                <span>Geometry</span>
                <span>Provenance</span>
                <i />
              </div>
              <div>
                <strong>CCT</strong>
                <span>Identity</span>
                <span>Validation</span>
                <i />
              </div>
            </div>
          </div>
        </article>

        <article id="gapwise-status" className="product-story-section product-story-status">
          <div>
            <ProductHeading
              label="Gapwise Status"
              title="Operations stay separate."
              body="An independently deployed status surface tracks public Gapwise services, preserves incident history, and runs automated public-surface checks every 15 minutes."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://status.gapwise.ca">Open Status</ExternalProductLink>
              <Link className="product-story-link" to="/ops">
                Operations
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="product-stage status-stage" aria-label="Gapwise monitored surfaces">
            <div className="status-stage-header">
              <ServerCog className="h-4 w-4" aria-hidden="true" />
              <span>Monitored surfaces</span>
              <small>15 min probes</small>
            </div>
            {["Gapwise", "API", "Gapwise AI", "Docs", "Data"].map((service) => (
              <div key={service} className="status-service">
                <span>{service}</span>
                <i aria-hidden="true" />
                <small>Monitored</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
