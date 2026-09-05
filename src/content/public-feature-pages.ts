export type PublicFeatureSection = {
  title: string;
  body: string;
  bullets?: readonly string[];
};

export type PublicFeaturePage = {
  path: string;
  eyebrow: string;
  title: string;
  seoTitle: string;
  description: string;
  lead: string;
  sections: readonly PublicFeatureSection[];
};

export const PUBLIC_FEATURE_PAGES = {
  about: {
    path: "/about",
    eyebrow: "About Gapwise",
    title: "A campus planner built around the time between classes.",
    seoTitle: "About Gapwise — Privacy-First Campus Planning for UTM",
    description:
      "Learn how Gapwise combines a UTM timetable, deterministic campus routing, gap planning, and privacy-first architecture into one student-built product.",
    lead: "Gapwise is an independent student-built campus intelligence project for the University of Toronto Mississauga. It is designed to answer a practical question a timetable alone cannot: what can you realistically do before the next class?",
    sections: [
      {
        title: "One product, clear responsibilities",
        body: "The core web app owns private student state and deterministic day planning. Shared UTM campus facts live in the Gapwise data project, developer contracts live in the public API and SDKs, AI access is optional and permissioned, and service status is independently hosted.",
        bullets: [
          "Local-first ACORN calendar parsing",
          "Deterministic gap and route calculations",
          "Source-backed campus data with explicit uncertainty",
          "Optional encrypted private sync and bounded AI delegation",
        ],
      },
      {
        title: "Privacy is an architectural constraint",
        body: "The original ACORN .ics file is parsed in the browser. Gapwise minimizes what must leave the device, keeps guest use first-class, and separates private timetable state from public campus data and optional integrations.",
      },
      {
        title: "Independent and open",
        body: "Gapwise is not an official University of Toronto service and does not imply university endorsement. Development, public contracts, data provenance, documentation, and service status are visible through the Gapwise GitHub organization and public Gapwise domains.",
      },
    ],
  },
  timetable: {
    path: "/utm-timetable",
    eyebrow: "UTM timetable",
    title: "Turn an ACORN export into a timetable that understands your day.",
    seoTitle: "UTM Timetable Planner — Gapwise",
    description:
      "Import a University of Toronto ACORN .ics calendar into Gapwise locally and get a UTM timetable connected to gaps, buildings, and campus routes.",
    lead: "Gapwise reads the calendar file ACORN already lets you export. The original file is processed on your device, then converted into a structured weekly timetable that can power gap planning and campus-aware navigation.",
    sections: [
      {
        title: "What the timetable adds",
        body: "Class times are only the start. Gapwise keeps course components, rooms, building codes, terms, weekends, and recurring dates connected so the same schedule can drive Today, Gap Plan, and Day Route views.",
      },
      {
        title: "Your academic schedule stays authoritative",
        body: "Imported academic meetings are not casually editable. Updating the timetable means importing a newer ACORN export, which keeps the product aligned with the source instead of quietly mutating official class meetings.",
      },
      {
        title: "Academic Work stays separate",
        body: "You can plan coursework and study blocks through Academic Work without turning the timetable into a general-purpose personal calendar. Gapwise keeps the student-planning layer focused on academic work and the gaps around class.",
      },
    ],
  },
  map: {
    path: "/campus-map",
    eyebrow: "Campus map",
    title: "Explore UTM with a map that knows Gapwise buildings and routes.",
    seoTitle: "UTM Campus Map — Gapwise",
    description:
      "Explore mapped University of Toronto Mississauga buildings, entrances, campus places, and routing context with Gapwise's privacy-first UTM campus map.",
    lead: "The Gapwise map is not just a background image. It connects canonical UTM building identities, source-backed geometry, routing nodes, entrances, and confidence information to the same campus model used by the planner.",
    sections: [
      {
        title: "Useful without a timetable",
        body: "The campus explorer can be opened without uploading a schedule. Search or select a supported building, inspect mapped campus context, and use public routing independently of private student state.",
      },
      {
        title: "No background location history",
        body: "Foreground device location is optional and only used when you ask for it. Ordinary Gapwise private sync does not store a route history or continuously track a student's movement across campus.",
      },
      {
        title: "Provenance over pretending",
        body: "Campus geometry and routing confidence are documented through Gapwise Data. Unknown or inferred details are labelled rather than being presented as verified facts.",
      },
    ],
  },
  gaps: {
    path: "/gap-planner",
    eyebrow: "Gap planner",
    title: "A two-hour gap is not always two hours of usable time.",
    seoTitle: "UTM Gap Planner — Gapwise",
    description:
      "See usable time between UTM classes after travel, transition buffers, setup, pack-up, meals, and campus context with Gapwise's deterministic gap planner.",
    lead: "Gap Plan turns the empty space between classes into a practical time budget. It starts with the exact interval, then accounts for the movement and buffers required to arrive at the next commitment on time.",
    sections: [
      {
        title: "Raw gap versus usable time",
        body: "Gapwise separates the calendar interval from the time you can safely spend. Route time, transition buffers, setup and pack-up preferences, and meal targets can all reduce the amount that is actually available.",
      },
      {
        title: "Deterministic recommendations",
        body: "When a recommendation depends on arithmetic or routing, normal code performs the calculation. Suggestions such as a focus sprint, meal window, quick reset, or leave-campus candidate are derived from reproducible inputs rather than an AI guessing the clock.",
      },
      {
        title: "Click a gap to inspect that exact interval",
        body: "Every highlighted gap in the timetable opens Gap Plan with that specific interval selected, so the weekly view and the detailed planner stay directly connected.",
      },
    ],
  },
  routing: {
    path: "/campus-routing",
    eyebrow: "Campus routing",
    title: "Campus routes should be computed, not improvised.",
    seoTitle: "UTM Campus Routing — Gapwise",
    description:
      "Plan deterministic routes between supported UTM buildings with explicit distance, travel-time, accessibility, and route-confidence information in Gapwise.",
    lead: "Gapwise treats routing as a deterministic campus problem. The routing engine uses the maintained UTM graph and reports what is verified, mixed, inferred, approximate, or unavailable instead of inventing a line when the data cannot support one.",
    sections: [
      {
        title: "Confidence travels with the answer",
        body: "A route is more useful when you know how it was produced. Gapwise keeps verification and accuracy information attached to routes so downstream screens, APIs, and integrations can preserve uncertainty rather than hiding it.",
      },
      {
        title: "Accessibility fails closed",
        body: "Step-free routing does not silently fall back to an unverified inaccessible path. If the maintained graph cannot support the requested accessibility constraint, Gapwise can report that the route is unavailable.",
      },
      {
        title: "Shared campus facts, private schedule context",
        body: "Building and routing data can be public and reusable. The student's timetable is a separate private input. Keeping those boundaries distinct lets Gapwise offer public campus intelligence without publishing anyone's routine.",
      },
    ],
  },
  acorn: {
    path: "/acorn-import",
    eyebrow: "ACORN import",
    title: "Import your U of T timetable without giving Gapwise your ACORN password.",
    seoTitle: "Import an ACORN Timetable into Gapwise",
    description:
      "Learn how to export your University of Toronto ACORN timetable as an .ics calendar and import it into Gapwise with browser-local parsing.",
    lead: "Gapwise does not need your ACORN credentials. You export the calendar file yourself, choose it on your device, and Gapwise parses the original .ics locally in the browser.",
    sections: [
      {
        title: "1. Export from ACORN",
        body: "Use ACORN's calendar export to download the .ics file for your current schedule. The export contains the meeting information Gapwise needs to reconstruct the weekly timetable.",
      },
      {
        title: "2. Choose the file in Gapwise",
        body: "The parser runs in your browser. The original calendar source bytes are not uploaded to a Gapwise API just to build your timetable.",
      },
      {
        title: "3. Review, update, or remove",
        body: "Check the imported terms and meetings. If ACORN changes, import a fresh export. You can also remove the timetable from the product; signed-in encrypted sync remains optional rather than required for ordinary use.",
      },
    ],
  },
} as const satisfies Record<string, PublicFeaturePage>;
