export type SeoWalkingBuilding = {
  slug: string;
  code: string;
  shortName: string;
  name: string;
};

export const SEO_WALKING_BUILDINGS = [
  {
    slug: "cct",
    code: "CCT",
    shortName: "CCT",
    name: "Communication, Culture and Technology Building",
  },
  {
    slug: "davis",
    code: "DV",
    shortName: "Davis",
    name: "William G. Davis Building",
  },
  {
    slug: "deerfield",
    code: "DH",
    shortName: "Deerfield",
    name: "Deerfield Hall",
  },
  {
    slug: "kaneff",
    code: "KN",
    shortName: "Kaneff",
    name: "Kaneff Centre",
  },
  {
    slug: "mn",
    code: "MN",
    shortName: "MN",
    name: "Maanjiwe nendamowinan",
  },
] as const satisfies readonly SeoWalkingBuilding[];

export type SeoWalkingRoute = {
  route: string;
  from: (typeof SEO_WALKING_BUILDINGS)[number];
  to: (typeof SEO_WALKING_BUILDINGS)[number];
};

export function listSeoWalkingRoutes(): SeoWalkingRoute[] {
  const routes: SeoWalkingRoute[] = [];

  for (let i = 0; i < SEO_WALKING_BUILDINGS.length; i += 1) {
    for (let j = i + 1; j < SEO_WALKING_BUILDINGS.length; j += 1) {
      const from = SEO_WALKING_BUILDINGS[i];
      const to = SEO_WALKING_BUILDINGS[j];
      routes.push({ route: `${from.slug}-to-${to.slug}`, from, to });
    }
  }

  return routes;
}

export function getSeoWalkingRoute(route: string): SeoWalkingRoute | null {
  return listSeoWalkingRoutes().find((candidate) => candidate.route === route) ?? null;
}
