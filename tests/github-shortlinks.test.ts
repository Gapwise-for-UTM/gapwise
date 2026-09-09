import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const expectedRedirects = new Map([
  ["/github", "https://github.com/Gapwise-for-UTM"],
  ["/github/app", "https://github.com/Gapwise-for-UTM/gapwise"],
  ["/github/ai", "https://github.com/Gapwise-for-UTM/gapwise-ai"],
  ["/github/data", "https://github.com/Gapwise-for-UTM/gapwise-data"],
  ["/github/mobile", "https://github.com/Gapwise-for-UTM/gapwise-mobile"],
  ["/github/status", "https://github.com/Gapwise-for-UTM/gapwise-status"],
  ["/github/docs", "https://github.com/Gapwise-for-UTM/gapwise-docs"],
]);

describe("canonical GitHub short links", () => {
  test("keeps every public alias as a permanent deployment redirect", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      redirects?: Array<{ source?: string; destination?: string; permanent?: boolean }>;
    };
    const redirects = new Map(
      (config.redirects ?? []).map((redirect) => [redirect.source, redirect] as const),
    );

    for (const [source, destination] of expectedRedirects) {
      expect(redirects.get(source)).toEqual({ source, destination, permanent: true });
    }
  });

  test("publishes the same aliases in the ecosystem navigation contract", async () => {
    const ecosystem = JSON.parse(await readFile("gapwise.ecosystem.json", "utf8")) as {
      githubOrganizationUrl?: string;
      repositories?: Record<string, string>;
    };

    expect(ecosystem.githubOrganizationUrl).toBe("https://gapwise.ca/github");
    expect(ecosystem.repositories).toEqual({
      core: "https://gapwise.ca/github/app",
      mobile: "https://gapwise.ca/github/mobile",
      ai: "https://gapwise.ca/github/ai",
      data: "https://gapwise.ca/github/data",
      docs: "https://gapwise.ca/github/docs",
      status: "https://gapwise.ca/github/status",
    });
  });
});
