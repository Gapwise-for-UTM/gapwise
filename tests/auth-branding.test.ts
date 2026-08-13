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

describe("OAuth authentication", () => {
  test("selects the configured providers and redirects to the current origin", async () => {
    const source = await readFile("src/features/auth/auth-service.ts", "utf8");
    expect(source).toContain('provider: "github"');
    expect(source).toContain('provider: "google"');
    expect(source).toContain('provider: "azure"');
    expect(source).toContain('scopes: "email"');
    expect(source).toContain("redirectTo: window.location.origin");
  });
  test("uses the documented identity fallback order", () => {
    expect(
      getAccountIdentity(
        user({
          email: "student@example.com",
          user_metadata: { name: "GitHub Student", user_name: "octo", full_name: "Student" },
        }),
      ),
    ).toBe("GitHub Student");
    expect(
      getAccountIdentity(user({ user_metadata: { user_name: "octo", full_name: "Student" } })),
    ).toBe("octo");
    expect(
      getAccountIdentity(
        user({ user_metadata: { preferred_username: "preferred", full_name: "Student" } }),
      ),
    ).toBe("preferred");
    expect(getAccountIdentity(user({ user_metadata: { full_name: "Student" } }))).toBe("Student");
    expect(getAccountIdentity(user({ email: "student@example.com" }))).toBe("student@example.com");
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
    expect(message).toBe("Sign-in failed: User cancelled");
    expect(replacement).toBe("/#top");
  });
});

describe("branding metadata", () => {
  test("declares valid manifest and existing logo assets", async () => {
    const manifest = JSON.parse(await readFile("public/site.webmanifest", "utf8"));
    expect(manifest).toMatchObject({
      name: "Gapwise for UTM",
      short_name: "Gapwise",
      display: "standalone",
      start_url: "/",
    });
    for (const path of [
      "logo-mark.svg",
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
  });

  test("keeps static bootstrap metadata separate from router-owned page metadata", async () => {
    const [html, rootRoute, indexRoute] = await Promise.all([
      readFile("index.html", "utf8"),
      readFile("src/routes/__root.tsx", "utf8"),
      readFile("src/routes/index.tsx", "utf8"),
    ]);

    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain('name="description"');
    expect(html).not.toContain("<title>");
    expect(html).not.toContain('rel="manifest"');

    expect(rootRoute).not.toContain("styles.css?url");
    expect(rootRoute).toContain('name: "mobile-web-app-capable"');
    expect(rootRoute).toContain('name: "apple-mobile-web-app-capable"');
    expect(rootRoute).toContain('rel: "manifest"');

    expect(indexRoute).toContain('const TITLE = "Gapwise for UTM — Smarter Campus Gaps"');
    expect(indexRoute).toContain('{ name: "description", content: DESCRIPTION }');
  });
});

describe("production content security policy", () => {
  test("allows WebAssembly compilation without enabling JavaScript eval", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8"));
    const headers = config.headers?.flatMap(
      (entry: { headers?: Array<{ key: string; value: string }> }) => entry.headers ?? [],
    );
    const csp = headers.find((header: { key: string }) => header.key === "Content-Security-Policy")
      ?.value as string | undefined;

    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' blob:");
    expect(csp).not.toContain("connect-src *");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
