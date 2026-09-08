import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("Gapwise marketing system", () => {
  test("tells the real five-product story without retired landing effects", async () => {
    const landing = await readFile("src/components/MarketingLanding.tsx", "utf8");
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
    expect(landing).toContain("/logo-mark.svg");
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
});
