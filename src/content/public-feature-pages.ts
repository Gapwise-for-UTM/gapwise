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
    seoTitle: "About Gapwise — Campus Planning for UTM",
    description:
      "See how Gapwise connects a UTM timetable, gap planning, campus routing, and day context in one focused student-built product.",
    lead: "Gapwise is built for the part of university life a timetable leaves blank: what to do next, how much time you actually have, and where you need to go.",
    sections: [
      {
        title: "One day, one system",
        body: "Your timetable, gaps, buildings, routes, and academic work stay connected instead of living in separate tools.",
        bullets: [
          "ACORN timetable import",
          "Gap budgets between classes",
          "UTM building and route context",
          "Academic work planning",
        ],
      },
      {
        title: "Built around useful time",
        body: "Gapwise turns the space between commitments into something you can act on, with travel time and the next class already part of the calculation.",
      },
      {
        title: "Made for UTM",
        body: "The product is shaped around UTM buildings, class patterns, campus movement, and the practical rhythm of a student day.",
      },
    ],
  },
  timetable: {
    path: "/utm-timetable",
    eyebrow: "UTM timetable",
    title: "Turn an ACORN export into a timetable that understands your day.",
    seoTitle: "UTM Timetable Planner — Gapwise",
    description:
      "Import a University of Toronto ACORN .ics calendar into Gapwise and get a UTM timetable connected to gaps, buildings, and campus routes.",
    lead: "Gapwise turns the calendar file ACORN already gives you into a weekly timetable that can power Today, Gap Plan, and campus navigation.",
    sections: [
      {
        title: "More than class blocks",
        body: "Course components, rooms, building codes, terms, weekends, and recurring dates stay connected so the same schedule can drive the rest of Gapwise.",
      },
      {
        title: "Update from ACORN",
        body: "When your schedule changes, import a fresh ACORN export and Gapwise rebuilds the weekly view around the new timetable.",
      },
      {
        title: "Academic work alongside class",
        body: "Plan coursework and study blocks without turning the timetable into a general-purpose calendar. The focus stays on the academic day.",
      },
    ],
  },
  map: {
    path: "/campus-map",
    eyebrow: "Campus map",
    title: "Explore UTM with a map built around your day.",
    seoTitle: "UTM Campus Map — Gapwise",
    description:
      "Explore University of Toronto Mississauga buildings, entrances, campus places, and route context with the Gapwise UTM campus map.",
    lead: "The Gapwise map connects UTM buildings, entrances, routes, and schedule context so campus navigation feels like part of the planner instead of a separate map tab.",
    sections: [
      {
        title: "Explore without setup",
        body: "Open the campus explorer, search a building, and move around UTM even before you import a timetable.",
      },
      {
        title: "Buildings and routes connected",
        body: "Canonical building identities and campus routes feed the same model used by Today and Gap Plan.",
      },
      {
        title: "Made for the next move",
        body: "Map context is designed to answer practical questions: where the next class is, what route connects two buildings, and how the move fits into the day.",
      },
    ],
  },
  gaps: {
    path: "/gap-planner",
    eyebrow: "Gap planner",
    title: "A two-hour gap is not always two hours of usable time.",
    seoTitle: "UTM Gap Planner — Gapwise",
    description:
      "See usable time between UTM classes after travel, transition buffers, setup, pack-up, meals, and campus context with Gapwise.",
    lead: "Gap Plan turns the empty space between classes into a practical time budget, with the next commitment already accounted for.",
    sections: [
      {
        title: "Raw gap versus usable time",
        body: "Route time, transition buffers, setup and pack-up preferences, and meal targets can all change how much of a gap is actually free.",
      },
      {
        title: "Recommendations that fit",
        body: "Gapwise turns the available window into focused options such as a meal, study block, reset, or longer work session.",
      },
      {
        title: "Inspect the exact interval",
        body: "Click a highlighted gap in the timetable and Gap Plan opens directly on that window, keeping the weekly view and detailed plan connected.",
      },
    ],
  },
  routing: {
    path: "/campus-routing",
    eyebrow: "Campus routing",
    title: "Know the move before the next class.",
    seoTitle: "UTM Campus Routing — Gapwise",
    description:
      "Plan routes between supported UTM buildings with travel time, distance, accessibility options, and timetable context in Gapwise.",
    lead: "Gapwise connects campus movement to the schedule so a route is not just a line on a map: it is part of the time budget before the next commitment.",
    sections: [
      {
        title: "Route time in context",
        body: "Travel time feeds directly into gap budgets and leave-by guidance, so movement across campus is reflected in the planner.",
      },
      {
        title: "Accessibility options",
        body: "Use supported step-free route options when planning movement between mapped campus locations.",
      },
      {
        title: "One campus model",
        body: "The same UTM building and route data powers the map, timetable context, Today view, and Gap Plan.",
      },
    ],
  },
  acorn: {
    path: "/acorn-import",
    eyebrow: "ACORN import",
    title: "Get your UTM timetable into Gapwise in a few clicks.",
    seoTitle: "Import an ACORN Timetable into Gapwise",
    description:
      "Export your University of Toronto ACORN timetable as an .ics calendar and turn it into a Gapwise weekly schedule.",
    lead: "Export the calendar file from ACORN, choose it in Gapwise, and your weekly timetable is ready for gaps, routes, and day planning.",
    sections: [
      {
        title: "1. Export from ACORN",
        body: "Use ACORN's calendar export to download the .ics file for your current schedule.",
      },
      {
        title: "2. Import into Gapwise",
        body: "Choose the file and Gapwise builds your weekly timetable with terms, meetings, rooms, and course components.",
      },
      {
        title: "3. Keep it current",
        body: "If your ACORN schedule changes, import a fresh export and Gapwise updates the timetable around it.",
      },
    ],
  },
} as const satisfies Record<string, PublicFeaturePage>;
