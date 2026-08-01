import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { getAccountIdentity, consumeOAuthError } from "../src/features/auth/auth-service";
import type { User } from "@supabase/supabase-js";

const user = (values: Partial<User>): User => ({
  id: "1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "",
  ...values,
});

describe("GitHub authentication", () => {
  test("selects GitHub and redirects to the current origin", async () => {
    const source = await readFile("src/features/auth/auth-service.ts", "utf8");
    expect(source).toContain('provider: "github"');
    expect(source).toContain("redirectTo: window.location.origin");
    expect(source).not.toContain('provider: "google"');
  });
  test("uses the documented identity fallback order", () => {
    expect(
      getAccountIdentity(
        user({
          email: "student@example.com",
          user_metadata: { user_name: "octo", full_name: "Student" },
        }),
      ),
    ).toBe("student@example.com");
    expect(
      getAccountIdentity(user({ user_metadata: { user_name: "octo", full_name: "Student" } })),
    ).toBe("octo");
    expect(
      getAccountIdentity(
        user({ user_metadata: { preferred_username: "preferred", full_name: "Student" } }),
      ),
    ).toBe("preferred");
    expect(getAccountIdentity(user({ user_metadata: { full_name: "Student" } }))).toBe("Student");
    expect(getAccountIdentity(user({}))).toBe("Signed in");
  });
  test("parses OAuth errors and cleans the URL without navigation", () => {
    let replacement = "";
    const message = consumeOAuthError(
      { href: "https://gapwise.test/?error=access_denied&error_description=User+cancelled#top" },
      {
        state: null,
        replaceState: (_data, _unused, url) => {
          replacement = String(url);
        },
      },
    );
    expect(message).toBe("GitHub sign-in failed: User cancelled");
    expect(replacement).toBe("/#top");
  });
});

describe("branding metadata", () => {
  test("declares valid manifest and existing logo assets", async () => {
    const manifest = JSON.parse(await readFile("public/site.webmanifest", "utf8"));
    expect(manifest).toMatchObject({
      name: "Gapwise UTM",
      short_name: "Gapwise",
      display: "standalone",
      start_url: "/",
    });
    const html = await readFile("index.html", "utf8");
    for (const path of [
      "favicon.svg",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "site.webmanifest",
    ]) {
      await expect(readFile(`public/${path}`)).resolves.toBeTruthy();
    }
    expect(html).toContain("Gapwise UTM — Smarter Campus Gaps");
    expect(html).toContain('rel="manifest" href="/site.webmanifest"');
  });
});
