import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { removeBareHash } from "@/lib/url";

describe("URL canonicalization", () => {
  test("removes only a bare hash while preserving path, query, and history state", () => {
    const state = { key: "router-state" };
    let replacement: { state: unknown; url: string } | null = null;

    expect(
      removeBareHash(
        {
          href: "https://gapwise-utm.vercel.app/?term=fall#",
          pathname: "/",
          search: "?term=fall",
        },
        {
          state,
          replaceState: (nextState, _unused, url) => {
            replacement = { state: nextState, url: String(url) };
          },
        },
      ),
    ).toBe(true);
    expect(replacement).toEqual({ state, url: "/?term=fall" });
  });

  test("leaves normal URLs and meaningful fragments untouched", () => {
    let replacements = 0;
    const history = {
      state: null,
      replaceState: () => {
        replacements += 1;
      },
    };

    expect(
      removeBareHash(
        { href: "https://gapwise-utm.vercel.app/", pathname: "/", search: "" },
        history,
      ),
    ).toBe(false);
    expect(
      removeBareHash(
        {
          href: "https://gapwise-utm.vercel.app/#access_token=token",
          pathname: "/",
          search: "",
        },
        history,
      ),
    ).toBe(false);
    expect(replacements).toBe(0);
  });
});

describe("first-class route deployment fallbacks", () => {
  test("keeps Vercel and Workbox navigation fallbacks on the app shell", async () => {
    const [vercelSource, viteSource, routeTree] = await Promise.all([
      readFile("vercel.json", "utf8"),
      readFile("vite.config.ts", "utf8"),
      readFile("src/routeTree.gen.ts", "utf8"),
    ]);
    const vercel = JSON.parse(vercelSource) as {
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(vercel.rewrites).toContainEqual({ source: "/(.*)", destination: "/index.html" });
    expect(viteSource).toContain('navigateFallback: "/index.html"');
    for (const path of ["/", "/today", "/timetable", "/gaps", "/route"]) {
      expect(routeTree).toContain(`'${path}'`);
    }
    expect(routeTree).not.toContain("HashHistory");
  });
});
