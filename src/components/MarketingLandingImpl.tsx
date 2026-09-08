import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UploadPanel } from "@/components/UploadPanel";
import type { MarketingLandingProps } from "./MarketingLanding";
import { MARKETING_PRODUCTS, type MarketingProductId } from "./marketing-products";
import "./marketing-landing.css";

function ProductMark() {
  return <span className="product-brand-mark" aria-hidden="true" />;
}

function ProductHeading({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="product-story-copy">
      <p className="product-story-label">
        <ProductMark />
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
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function MarketingLandingImpl({
  isOnline,
  onFile,
  onDemo,
  loading,
  error,
  remember,
  onRememberChange,
  rememberAvailable,
}: MarketingLandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeProduct, setActiveProduct] = useState<MarketingProductId>("gapwise");

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;

    const entriesBySection = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entriesBySection.set(entry.target, entry);
        const viewportCenter = window.innerHeight * 0.45;
        const visible = [...entriesBySection.values()]
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            const aCenter = a.boundingClientRect.top + a.boundingClientRect.height / 2;
            const bCenter = b.boundingClientRect.top + b.boundingClientRect.height / 2;
            return Math.abs(aCenter - viewportCenter) - Math.abs(bCenter - viewportCenter);
          });
        const next = visible[0]?.target.getAttribute("data-product") as MarketingProductId | null;
        if (next) setActiveProduct(next);
      },
      { rootMargin: "-34% 0px -48% 0px", threshold: 0 },
    );

    root.querySelectorAll<HTMLElement>("[data-product]").forEach((section) => {
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.landingProduct = activeProduct;
  }, [activeProduct]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.landingProduct;
    },
    [],
  );

  return (
    <div ref={rootRef} className="marketing-home" data-active-product={activeProduct}>
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
          {MARKETING_PRODUCTS.map((product) => {
            const active = activeProduct === product.id;
            return (
              <a
                key={product.id}
                href={`#${product.id}`}
                data-active={active ? "true" : undefined}
                aria-current={active ? "location" : undefined}
              >
                <i aria-hidden="true" />
                {product.shortLabel}
              </a>
            );
          })}
        </div>
      </nav>

      <div className="product-story">
        <article
          id="gapwise"
          data-product="gapwise"
          data-active={activeProduct === "gapwise" ? "true" : undefined}
          className="product-story-section product-story-core"
        >
          <div>
            <ProductHeading
              label="Gapwise"
              title="Plan the time between classes."
              body="Your weekly timetable, gap plan, and campus movement share one schedule context, so every view stays focused on what comes next."
            />
            <div className="product-story-actions">
              <Link className="product-story-link" to="/utm-timetable">
                Timetable <span aria-hidden="true">↗</span>
              </Link>
              <Link className="product-story-link" to="/gap-planner">
                Gap planner <span aria-hidden="true">↗</span>
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
              <span className="stage-symbol" aria-hidden="true">
                ⌁
              </span>
              <span>Schedule context flows into Gap Plan and Day Route</span>
            </div>
          </div>
        </article>

        <article
          id="gapwise-ai"
          data-product="gapwise-ai"
          data-active={activeProduct === "gapwise-ai" ? "true" : undefined}
          className="product-story-section product-story-ai"
        >
          <div>
            <ProductHeading
              label="Gapwise AI"
              title="Campus context, permissioned."
              body="The Gapwise MCP layer exposes deterministic public campus intelligence plus student context you explicitly delegate. Your connected AI client supplies the reasoning."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://ai.gapwise.ca">Gapwise AI</ExternalProductLink>
              <ExternalProductLink href="https://ai.gapwise.ca/api/mcp">
                MCP endpoint
              </ExternalProductLink>
            </div>
          </div>

          <div className="product-stage ai-stage" aria-label="Gapwise AI tool preview">
            <div className="ai-command">
              <ProductMark />
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

        <article
          id="gapwise-docs"
          data-product="gapwise-docs"
          data-active={activeProduct === "gapwise-docs" ? "true" : undefined}
          className="product-story-section product-story-docs"
        >
          <div>
            <ProductHeading
              label="Gapwise Docs"
              title="Contracts you can build against."
              body="Canonical OpenAPI, JavaScript and Python SDK references, platform guides, security boundaries, and AI integration documentation live in one technical surface."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://docs.gapwise.ca">Open Docs</ExternalProductLink>
              <Link className="product-story-link" to="/developers">
                Developer platform <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <div className="product-stage docs-stage" aria-label="Gapwise Docs preview">
            <div className="docs-sidebar">
              <ProductMark />
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

        <article
          id="gapwise-data"
          data-product="gapwise-data"
          data-active={activeProduct === "gapwise-data" ? "true" : undefined}
          className="product-story-section product-story-data"
        >
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
              <ProductMark />
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

        <article
          id="gapwise-status"
          data-product="gapwise-status"
          data-active={activeProduct === "gapwise-status" ? "true" : undefined}
          className="product-story-section product-story-status"
        >
          <div>
            <ProductHeading
              label="Gapwise Status"
              title="Operations stay separate."
              body="An independently deployed status surface tracks public Gapwise services, preserves incident history, and runs automated public-surface checks every 15 minutes."
            />
            <div className="product-story-actions">
              <ExternalProductLink href="https://status.gapwise.ca">
                Open Status
              </ExternalProductLink>
              <Link className="product-story-link" to="/ops">
                Operations <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <div className="product-stage status-stage" aria-label="Gapwise monitored surfaces">
            <div className="status-stage-header">
              <ProductMark />
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
