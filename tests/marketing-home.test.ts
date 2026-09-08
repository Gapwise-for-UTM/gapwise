import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("Gapwise marketing system", () => {
  test("tells the real five-product story without retired landing effects", async () => {
    const landing = await readFile("src/components/MarketingLandingImpl.tsx", "utf8");
    const app = await readFile("src/routes/_app.tsx", "utf8");

    for (const product of [
      "Gapwise",
      "Gapwise AI",
      "Gapwise Docs",
      "Gapwise Data",
      "Gapwise Status",
    ]) {
      expect(landing).toContain(product);
    }

    expect(landing).toContain("https://ai.gapwise.ca/api/mcp");
    expect(landing).toContain("https://docs.gapwise.ca");
    expect(landing).toContain("https://data.gapwise.ca");
    expect(landing).toContain("https://status.gapwise.ca");
    expect(app).toContain("<MarketingLanding");
    expect(app).not.toContain("landing-bento rise-in");
    expect(app).not.toContain("Private by design");
    expect(app).not.toContain("Independent student project");
    expect(app).not.toContain("--parallax-");
  });

  test("keeps motion native, restrained, and reducible", async () => {
    const css = await readFile("src/components/marketing-landing.css", "utf8");
    const brand = await readFile("src/brand-blue.css", "utf8");

    expect(css).toContain("animation-timeline: view()");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toMatch(/radial-gradient|filter:\s*blur|box-shadow:\s*0 0/i);
    expect(brand).not.toMatch(/radial-gradient|linear-gradient/i);
    expect(brand).not.toContain("#5965cc");
    expect(brand).not.toContain("#6975df");
    expect(brand).toContain("main.landing-stage .hero-word::after");
    expect(brand).toContain("display: none !important");
  });

  test("pins the mobile public chrome instead of handing off between sticky rows", async () => {
    const stability = await readFile("src/landing-mobile-stability.css", "utf8");
    const html = await readFile("index.html", "utf8");

    expect(html).toContain("viewport-fit=cover");
    expect(stability).toContain("--gapwise-safe-top: env(safe-area-inset-top, 0px)");
    expect(stability).toMatch(/\.desktop-app-header\s*\{[\s\S]*position:\s*fixed\s*!important/);
    expect(stability).toMatch(/\.product-story-nav\s*\{[\s\S]*position:\s*fixed\s*!important/);
    expect(stability).toContain(
      "padding-top: var(--gapwise-public-chrome-height) !important;",
    );
    expect(stability).toContain("transform: translate3d(0, 0, 0)");
  });
});
