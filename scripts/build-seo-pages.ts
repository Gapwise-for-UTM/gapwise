import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { listSeoWalkingRoutes } from "../src/data/seo-walking-routes.js";
import { routeBetweenPublicBuildings } from "../src/server/public-campus/service.js";

const SITE_ORIGIN = "https://gapwise.ca";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/icon-512.png`;

type SeoPage = {
  path: string;
  title: string;
  description: string;
  heading: string;
  detail: string;
  sitemap: boolean;
  structuredData?: Record<string, unknown>;
};

const STATIC_PAGES: readonly SeoPage[] = [
  {
    path: "/",
    title: "Gapwise UTM — Timetable, Gap & Campus Route Planner",
    description:
      "Gapwise is an independent UTM student app for ACORN timetable import, useful gap planning, and campus routes. The original .ics file stays in your browser.",
    heading: "Plan your UTM day around the time between classes.",
    detail:
      "Import an ACORN .ics timetable in your browser, see useful gaps and leave-by timing, and navigate source-backed UTM campus routes. Guest mode and a demo are available without an account.",
    sitemap: true,
  },
  {
    path: "/utm/walking-times",
    title: "UTM Building Walking Times — Gapwise",
    description:
      "Check Gapwise walking-time estimates between major University of Toronto Mississauga buildings, including Davis, CCT, Deerfield, Kaneff, and MN.",
    heading: "UTM building walking times",
    detail:
      "Compare deterministic Gapwise route estimates for major UTM building pairs. Route confidence and evidence remain explicit, and estimates are planning guidance rather than guarantees.",
    sitemap: true,
  },
  {
    path: "/places",
    title: "UTM Campus Places — Gapwise UTM",
    description:
      "Explore source-backed UTM dining, study, service, library, and recreation places with explicit freshness and conservative handling of unknown hours.",
    heading: "Practical places at UTM, with source-backed details.",
    detail:
      "Gapwise keeps place identity, source provenance, and freshness explicit. Missing live hours stay unknown instead of being guessed as open or closed.",
    sitemap: true,
  },
  {
    path: "/places/davis-food-court",
    title: "Davis Food Court at UTM — Gapwise UTM",
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
    title: "Gapwise UTM API & SDKs — Developers",
    description:
      "Build with the Gapwise public UTM building, place, routing, and deterministic gap-planning API, OpenAPI contract, and official SDKs.",
    heading: "Deterministic UTM campus intelligence for developers.",
    detail:
      "Gapwise publishes a bounded public API for UTM buildings, places, routing, and gap planning, with OpenAPI and JavaScript/TypeScript and Python SDK documentation.",
    sitemap: true,
  },
  {
    path: "/trust",
    title: "Trust Center — Gapwise UTM",
    description:
      "Evidence-backed privacy, security, accessibility, data-flow, campus-routing, AI permission, incident-response, and independence information for Gapwise UTM.",
    heading: "Gapwise UTM Trust Center",
    detail:
      "Review implementation-backed privacy and security boundaries, campus-routing evidence, accessibility evidence, incident processes, subprocessors, AI permissions, and open items that still require human or provider confirmation.",
    sitemap: true,
  },
  {
    path: "/privacy",
    title: "Privacy — Gapwise UTM",
    description:
      "How Gapwise UTM handles timetable, account, planning, AI, analytics, and foreground location data, including browser-local ACORN parsing.",
    heading: "Privacy at Gapwise UTM",
    detail:
      "The original ACORN .ics file is parsed in the browser. Guest mode is first-class, private cloud sync is optional, and precise live location is foreground-only when requested.",
    sitemap: true,
  },
  {
    path: "/security",
    title: "Vulnerability Disclosure — Gapwise UTM",
    description:
      "How to report a suspected Gapwise UTM security vulnerability privately and safely, including the preferred private reporting path.",
    heading: "Report a Gapwise security issue privately.",
    detail:
      "Gapwise publishes a vulnerability disclosure policy and canonical security.txt. Do not place exploit details, credentials, tokens, or private student data in public issues.",
    sitemap: true,
  },
  {
    path: "/accessibility",
    title: "Accessibility — Gapwise UTM",
    description:
      "Gapwise UTM's accessibility target, current automated and keyboard-test evidence, known limitations, and feedback path.",
    heading: "Accessibility is an ongoing Gapwise practice.",
    detail:
      "Gapwise uses WCAG 2.2 Level AA as a product and review target while clearly separating current automated evidence from manual or independent assessment that has not occurred.",
    sitemap: true,
  },
  {
    path: "/terms",
    title: "Terms — Gapwise UTM",
    description:
      "Terms and important notices for the independent Gapwise UTM student timetable, gap-planning, and campus-routing application.",
    heading: "Gapwise terms and notices",
    detail:
      "Gapwise is an independent student project. Review the current product terms and notices without implying University of Toronto approval or endorsement.",
    sitemap: false,
  },
];

function walkingSeoPages(): SeoPage[] {
  return listSeoWalkingRoutes().flatMap(({ route, from, to }) => {
    const result = routeBetweenPublicBuildings({ from: from.code, to: to.code });
    if (
      "error" in result ||
      result.status === "unavailable" ||
      result.estimatedSeconds === null ||
      result.totalDistanceMeters === null
    ) {
      return [];
    }

    const minutes = Math.max(1, Math.ceil(result.estimatedSeconds / 60));
    const metres = Math.round(result.totalDistanceMeters / 10) * 10;
    const path = `/utm/walking-time/${route}`;
    const title = `${from.shortName} to ${to.shortName} Walking Time at UTM — Gapwise`;
    const description = `It takes about ${minutes} minutes to walk from ${from.name} to ${to.name} at UTM using the current Gapwise ${result.status === "routed" ? "mapped campus route" : "campus estimate"}.`;

    return [
      {
        path,
        title,
        description,
        heading: `${from.shortName} to ${to.shortName} walking time at UTM`,
        detail: `Gapwise estimates about ${minutes} minutes over approximately ${metres} metres from ${from.name} to ${to.name}. Route evidence is ${result.routeVerification}; ${result.accuracy.toLowerCase()}. Walking times are planning estimates and can vary with entrances, elevators, accessibility needs, congestion, construction, weather, route choice, and walking speed.`,
        sitemap: true,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          url: canonicalUrl(path),
          description,
          isPartOf: {
            "@type": "WebSite",
            name: "Gapwise",
            url: `${SITE_ORIGIN}/`,
          },
          about: [
            { "@type": "Place", name: from.name },
            { "@type": "Place", name: to.name },
          ],
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Gapwise",
                item: `${SITE_ORIGIN}/`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "UTM walking times",
                item: `${SITE_ORIGIN}/utm/walking-times`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `${from.shortName} to ${to.shortName}`,
                item: canonicalUrl(path),
              },
            ],
          },
        },
      },
    ];
  });
}

const PAGES: readonly SeoPage[] = [...STATIC_PAGES, ...walkingSeoPages()];

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

function jsonLd(value: Record<string, unknown>) {
  return `<script type="application/ld+json">${JSON.stringify(value).replaceAll("<", "\\u003c")}</script>`;
}

function metadata(page: SeoPage) {
  const canonical = canonicalUrl(page.path);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const schemas: string[] = [];

  if (page.path === "/") {
    schemas.push(
      jsonLd({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "@id": `${SITE_ORIGIN}/#webapp`,
        name: "Gapwise",
        alternateName: "Gapwise UTM",
        url: `${SITE_ORIGIN}/`,
        description: page.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires a modern web browser with JavaScript enabled.",
        isAccessibleForFree: true,
        inLanguage: "en-CA",
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
          "UTM timetable and gap planning",
          "UTM campus building-to-building routing",
          "Walking-time and leave-by estimates",
          "Optional browser-encrypted private sync",
        ],
        author: {
          "@type": "Person",
          name: "Andrew Muratov",
          url: "https://github.com/andrewmuratov",
        },
        softwareHelp: {
          "@type": "CreativeWork",
          name: "Gapwise Documentation",
          url: "https://docs.gapwise.ca/",
        },
        sameAs: ["https://github.com/andrewmuratov/gapwise"],
      }),
    );
  }

  if (page.structuredData) schemas.push(jsonLd(page.structuredData));

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="application-name" content="Gapwise UTM" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Gapwise UTM" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SOCIAL_IMAGE}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:image:alt" content="Gapwise route-shaped G mark" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${SOCIAL_IMAGE}" />
    ${schemas.join("\n    ")}`;
}

function fallback(page: SeoPage) {
  const links = [
    ["/", "Gapwise UTM home"],
    ["/utm/walking-times", "UTM building walking times"],
    ["/places", "UTM campus places"],
    ["/developers", "Developer API and SDKs"],
    ["/trust", "Trust Center"],
    ["/privacy", "Privacy"],
    ["/accessibility", "Accessibility"],
  ] as const;
  const navigation = links
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join(" · ");

  return `<main data-gapwise-search-fallback style="max-width:54rem;margin:0 auto;padding:3rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.6">
      <p><strong>Gapwise UTM</strong></p>
      <h1>${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <p>${escapeHtml(page.detail)}</p>
      <p><a href="/">Open Gapwise</a> to use the estimate with your ACORN timetable, schedule gaps, route confidence, and leave-by planning.</p>
      <p>Gapwise is an independent student project for University of Toronto Mississauga. It is not an official University of Toronto service and does not claim university approval, sponsorship, or endorsement.</p>
      <nav aria-label="Gapwise public pages">${navigation}</nav>
    </main>`;
}

function renderDocument(baseHtml: string, page: SeoPage) {
  if (!baseHtml.includes("</head>")) throw new Error("Built index is missing </head>.");
  if (!/<div id="root"><\/div>/.test(baseHtml)) {
    throw new Error("Built index is missing the empty #root mount point.");
  }

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
  `Generated ${PAGES.length} crawlable Gapwise UTM HTML entry points and ${PAGES.filter((page) => page.sitemap).length} sitemap URLs.`,
);
