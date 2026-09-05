import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PUBLIC_FEATURE_PAGES } from "../src/content/public-feature-pages";

const SITE_ORIGIN = "https://gapwise.ca";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-gapwise.png`;
const GITHUB_ORGANIZATION = "https://github.com/Gapwise-for-UTM";
const GITHUB_CORE = `${GITHUB_ORGANIZATION}/gapwise`;

type SeoSection = { title: string; body: string; bullets?: readonly string[] };
type SeoPage = {
  path: string;
  title: string;
  description: string;
  heading: string;
  detail: string;
  sections?: readonly SeoSection[];
  sitemap: boolean;
};

const FEATURE_PAGES: readonly SeoPage[] = Object.values(PUBLIC_FEATURE_PAGES).map((page) => ({
  path: page.path,
  title: page.seoTitle,
  description: page.description,
  heading: page.title,
  detail: page.lead,
  sections: page.sections,
  sitemap: true,
}));

const PAGES: readonly SeoPage[] = [
  {
    path: "/",
    title: "Gapwise — UTM Timetable, Gap Planner & Campus Routes",
    description:
      "Gapwise is a privacy-first campus planner for University of Toronto Mississauga students: import your ACORN timetable locally, understand gaps, and plan campus routes.",
    heading: "Make the time between classes count.",
    detail:
      "Import an ACORN .ics timetable in your browser, understand the usable time between classes, and navigate source-backed UTM campus routes. Guest mode and a demo work without an account.",
    sections: [
      {
        title: "Your timetable, connected to campus context",
        body: "Gapwise combines class times, rooms, UTM buildings, deterministic travel time, and gap budgets so the schedule can answer more than when the next class begins.",
      },
      {
        title: "Private by architecture",
        body: "The original ACORN .ics file is parsed locally in the browser. Private sync is optional, public campus data stays separate from private student state, and foreground location is not retained as a movement history.",
      },
      {
        title: "Algorithms where correctness matters",
        body: "Gap durations, leave-by times, route selection, and other computable values use deterministic code. Optional AI interfaces are bounded to the places where interpretation is actually useful.",
      },
    ],
    sitemap: true,
  },
  ...FEATURE_PAGES,
  {
    path: "/places",
    title: "UTM Campus Places — Gapwise",
    description:
      "Explore source-backed UTM dining, study, service, library, and recreation places with explicit freshness and conservative handling of unknown hours.",
    heading: "Practical places at UTM, with source-backed details.",
    detail:
      "Gapwise keeps place identity, source provenance, and freshness explicit. Missing live hours stay unknown instead of being guessed as open or closed.",
    sitemap: true,
  },
  {
    path: "/places/davis-food-court",
    title: "Davis Food Court at UTM — Gapwise",
    description:
      "Source-backed location and practical details for Davis Food Court in the William G. Davis Building at UTM.",
    heading: "Davis Food Court at UTM",
    detail:
      "Gapwise records this dining location in the William G. Davis Building and links back to the official UTM Hospitality source for current information.",
    sitemap: true,
  },
  {
    path: "/places/utm-library",
    title: "UTM Library — Hazel McCallion Academic Learning Centre | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Hazel McCallion Academic Learning Centre and library.",
    heading: "UTM Library and Hazel McCallion Academic Learning Centre",
    detail:
      "Gapwise records the library as a source-backed campus place for individual study, group study, and library services, while leaving unbundled current hours unknown.",
    sitemap: true,
  },
  {
    path: "/places/rawc",
    title: "UTM RAWC — Recreation, Athletics & Wellness | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Recreation, Athletics and Wellness Centre (RAWC).",
    heading: "UTM Recreation, Athletics and Wellness Centre",
    detail:
      "Gapwise records RAWC as a source-backed recreation and fitness destination and links to the official UTM athletics source for current information.",
    sitemap: true,
  },
  {
    path: "/developers",
    title: "Gapwise API & SDKs — Developers",
    description:
      "Build with the Gapwise public UTM building, place, routing, and deterministic gap-planning API, OpenAPI contract, and official SDKs.",
    heading: "Deterministic UTM campus intelligence for developers.",
    detail:
      "Gapwise publishes a bounded public API for UTM buildings, places, routing, and gap planning, with OpenAPI plus JavaScript/TypeScript and Python SDK documentation.",
    sitemap: true,
  },
  {
    path: "/ai",
    title: "Gapwise AI — Connect Gapwise to AI Assistants",
    description:
      "Connect explicitly delegated Gapwise timetable context and deterministic UTM campus intelligence to compatible AI assistants through Gapwise's secure remote MCP service.",
    heading: "Your Gapwise context, with an assistant you choose.",
    detail:
      "Gapwise AI exposes public campus intelligence plus narrowly delegated timetable, availability, gap-planning, and compatibility-scoped planning capabilities. Academic meetings remain read-only and AI access can be revoked.",
    sitemap: true,
  },
  {
    path: "/support",
    title: "Support — Gapwise",
    description:
      "Support for Gapwise accounts, timetables, AI connectors, privacy, security, revocation, and troubleshooting.",
    heading: "Help with Gapwise.",
    detail:
      "Find first-party guidance for connector authorization, missing schedule context, rejected writes, revocation, privacy, security reporting, and service status.",
    sitemap: true,
  },
  {
    path: "/trust",
    title: "Trust Center — Gapwise",
    description:
      "Evidence-backed privacy, security, accessibility, data-flow, AI permission, incident-response, and independence information for Gapwise.",
    heading: "Gapwise Trust Center",
    detail:
      "Review implementation-backed privacy and security boundaries, accessibility evidence, incident processes, subprocessors, AI permissions, and open items that still require human or provider confirmation.",
    sitemap: true,
  },
  {
    path: "/privacy",
    title: "Privacy — Gapwise",
    description:
      "How Gapwise handles timetable, account, planning, AI, analytics, and foreground location data, including browser-local ACORN parsing.",
    heading: "Privacy at Gapwise",
    detail:
      "The original ACORN .ics file is parsed in the browser. Guest mode is first-class, private cloud sync is optional, and precise live location is foreground-only when requested.",
    sitemap: true,
  },
  {
    path: "/security",
    title: "Vulnerability Disclosure — Gapwise",
    description:
      "How to report a suspected Gapwise security vulnerability privately and safely, including the preferred private reporting path.",
    heading: "Report a Gapwise security issue privately.",
    detail:
      "Gapwise publishes a vulnerability disclosure policy and canonical security.txt. Do not place exploit details, credentials, tokens, or private student data in public issues.",
    sitemap: true,
  },
  {
    path: "/accessibility",
    title: "Accessibility — Gapwise",
    description:
      "Gapwise's accessibility target, current automated and keyboard-test evidence, known limitations, and feedback path.",
    heading: "Accessibility is an ongoing Gapwise practice.",
    detail:
      "Gapwise uses WCAG 2.2 Level AA as a product and review target while clearly separating current automated evidence from manual or independent assessment that has not occurred.",
    sitemap: true,
  },
  {
    path: "/terms",
    title: "Terms — Gapwise",
    description:
      "Terms and important notices for the independent Gapwise student timetable, gap-planning, and campus-routing application for UTM.",
    heading: "Gapwise terms and notices",
    detail:
      "Gapwise is an independent student project. Review the current product terms and notices without implying University of Toronto approval or endorsement.",
    sitemap: false,
  },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function canonicalUrl(path: string) {
  return new URL(path, `${SITE_ORIGIN}/`).href;
}

function outputPath(path: string) {
  if (path === "/") return "index.html";
  return `_seo/${path.slice(1).replaceAll("/", "--")}.html`;
}

function homepageStructuredData(page: SeoPage) {
  const organizationId = `${SITE_ORIGIN}/#organization`;
  const websiteId = `${SITE_ORIGIN}/#website`;
  const appId = `${SITE_ORIGIN}/#app`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description:
          "Privacy-first campus intelligence and day planning for University of Toronto Mississauga students.",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/icon-512.png`,
          width: 512,
          height: 512,
        },
        founder: {
          "@type": "Person",
          name: "Andrew Muratov",
          url: "https://github.com/andrewmuratov",
        },
        email: "support@gapwise.ca",
        sameAs: [GITHUB_ORGANIZATION],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description: page.description,
        inLanguage: "en-CA",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": appId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description: page.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        inLanguage: "en-CA",
        creator: { "@id": organizationId },
        publisher: { "@id": organizationId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CAD",
        },
        audience: {
          "@type": "Audience",
          audienceType: "University of Toronto Mississauga students",
        },
        featureList: [
          "Browser-local ACORN timetable import",
          "UTM timetable and deterministic gap planning",
          "UTM campus map and routing",
          "Optional encrypted private sync",
        ],
        sameAs: [GITHUB_CORE],
      },
    ],
  };
}

function metadata(page: SeoPage) {
  const canonical = canonicalUrl(page.path);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const schema =
    page.path === "/"
      ? `\n    <script type="application/ld+json">${JSON.stringify(homepageStructuredData(page)).replaceAll("<", "\\u003c")}</script>`
      : "";

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="application-name" content="Gapwise" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Gapwise" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SOCIAL_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Gapwise — make the time between classes count" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${SOCIAL_IMAGE}" />${schema}`;
}

function fallback(page: SeoPage) {
  const links = [
    ["/", "Gapwise home"],
    ["/about", "About Gapwise"],
    ["/utm-timetable", "UTM timetable"],
    ["/gap-planner", "Gap planner"],
    ["/campus-map", "Campus map"],
    ["/campus-routing", "Campus routing"],
    ["/acorn-import", "ACORN import"],
    ["/places", "UTM campus places"],
    ["/developers", "Developer API and SDKs"],
    ["/ai", "Gapwise AI"],
    ["/support", "Support"],
    ["/trust", "Trust Center"],
    ["/privacy", "Privacy"],
    ["/accessibility", "Accessibility"],
  ] as const;
  const navigation = links
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join(" · ");
  const sections = (page.sections ?? [])
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>${
          section.bullets?.length
            ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
            : ""
        }</section>`,
    )
    .join("\n");

  return `<main data-gapwise-search-fallback style="max-width:60rem;margin:0 auto;padding:3rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.65">
      <p><strong>Gapwise</strong> · University of Toronto Mississauga</p>
      <h1>${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <p>${escapeHtml(page.detail)}</p>
      ${sections}
      <p>Gapwise is an independent student project for University of Toronto Mississauga. It is not an official University of Toronto service and does not claim university approval, sponsorship, or endorsement.</p>
      <nav aria-label="Gapwise public pages">${navigation}</nav>
    </main>`;
}

function renderDocument(baseHtml: string, page: SeoPage) {
  if (!baseHtml.includes("</head>")) throw new Error("Built index is missing </head>.");
  if (!/<div id="root"><\/div>/.test(baseHtml))
    throw new Error("Built index is missing the empty #root mount point.");

  return baseHtml
    .replace("</head>", `${metadata(page)}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${fallback(page)}</div>`);
}

function renderSitemap() {
  const urls = PAGES.filter((page) => page.sitemap)
    .map((page) => `  <url><loc>${canonicalUrl(page.path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const distIndexPath = join("dist", "index.html");
const baseHtml = await readFile(distIndexPath, "utf8");

for (const page of PAGES) {
  const destination = join("dist", outputPath(page.path));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderDocument(baseHtml, page));
}

const expectedSitemap = renderSitemap();
const committedSitemap = await readFile(join("public", "sitemap.xml"), "utf8");
if (committedSitemap !== expectedSitemap) {
  throw new Error("public/sitemap.xml is out of sync with the production SEO page inventory.");
}
await writeFile(join("dist", "sitemap.xml"), expectedSitemap);

console.log(
  `Generated ${PAGES.length} crawlable Gapwise HTML entry points and ${PAGES.filter((page) => page.sitemap).length} sitemap URLs.`,
);
