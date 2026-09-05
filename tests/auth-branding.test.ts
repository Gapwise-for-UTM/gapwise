import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildGoogleOidcAuthorizationUrl,
  consumeOAuthError,
  createGoogleNonce,
  getAccountIdentity,
  googleRedirectRequiredForIos,
} from "../src/features/auth/auth-service";
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
  test("selects the configured providers and uses same-origin PKCE callbacks", async () => {
    const [serviceSource, clientSource] = await Promise.all([
      readFile("src/features/auth/auth-service.ts", "utf8"),
      readFile("src/lib/supabase.ts", "utf8"),
    ]);
    expect(serviceSource).toContain('provider: "github"');
    expect(serviceSource).toContain('provider: "google"');
    expect(serviceSource).toContain('provider: "azure"');
    expect(serviceSource).toContain('scopes: "email"');
    expect(serviceSource).toContain("function authRedirectTarget");
    expect(serviceSource).toContain("target.origin !== window.location.origin");
    expect(serviceSource).toContain("redirectTo: authRedirectTarget(redirectTo)");
    expect(serviceSource).toContain("assertCanPersistAuthRedirect()");
    expect(serviceSource).toContain("use_fedcm_for_prompt: true");
    expect(serviceSource).toContain("isDismissedMoment()");
    expect(serviceSource).toContain("fallBackFromGooglePrompt");
    expect(clientSource).toContain("detectSessionInUrl: true");
    expect(clientSource).toContain('flowType: "pkce"');
  });

  test("keeps the unverified direct Google redirect fail-closed behind a rollout flag", async () => {
    const [serviceSource, envExample] = await Promise.all([
      readFile("src/features/auth/auth-service.ts", "utf8"),
      readFile(".env.example", "utf8"),
    ]);
    expect(serviceSource).toContain('import.meta.env["VITE_GOOGLE_DIRECT_REDIRECT_ENABLED"]');
    expect(serviceSource).toContain('=== "true"');
    expect(serviceSource).toContain(
      "if (!directRedirectEnabled) return signInWithGoogleOAuthFallback",
    );
    expect(serviceSource).toContain(": signInWithGoogleOAuthFallback(redirectTo)");
    expect(envExample).toContain("VITE_GOOGLE_DIRECT_REDIRECT_ENABLED=false");
    expect(envExample).toContain("verified on a real iPhone/iPad");
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

  test("creates a strong SHA-256 hexadecimal Google nonce for the GIS token exchange", async () => {
    const first = await createGoogleNonce();
    const second = await createGoogleNonce();
    expect(first.raw).not.toBe(first.hashed);
    expect(first.raw.length).toBeGreaterThanOrEqual(43);
    expect(first.hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(second.raw).not.toBe(first.raw);
  });

  test("uses a Gapwise-owned OIDC redirect for iOS instead of the Supabase hostname", () => {
    expect(
      googleRedirectRequiredForIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6)", "iPhone", 5),
    ).toBe(true);
    expect(googleRedirectRequiredForIos("Mozilla/5.0 Safari", "MacIntel", 5)).toBe(true);
    expect(googleRedirectRequiredForIos("Mozilla/5.0 Chrome", "MacIntel", 0)).toBe(false);

    const authorizationUrl = new URL(
      buildGoogleOidcAuthorizationUrl({
        clientId: "client.apps.googleusercontent.com",
        origin: "https://gapwise.ca",
        state: "state-token",
        hashedNonce: "a".repeat(64),
      }),
    );
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(
      "client.apps.googleusercontent.com",
    );
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe("https://gapwise.ca/");
    expect(authorizationUrl.searchParams.get("response_type")).toBe("id_token");
    expect(authorizationUrl.searchParams.get("response_mode")).toBe("fragment");
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(authorizationUrl.searchParams.get("state")).toBe("state-token");
    expect(authorizationUrl.searchParams.get("nonce")).toBe("a".repeat(64));
    expect(authorizationUrl.href).not.toContain("supabase.co");
  });

  test("cleans provider OAuth errors without exposing provider internals", () => {
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
    expect(message).toBe("We couldn't complete sign-in. Try again.");
    expect(replacement).toBe("/#top");
  });
});

describe("branding metadata", () => {
  test("declares valid manifest and existing logo assets", async () => {
    const manifest = JSON.parse(await readFile("public/site.webmanifest", "utf8"));
    expect(manifest).toMatchObject({
      name: "Gapwise",
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
      readFile("src/routes/_app.index.tsx", "utf8"),
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

    expect(indexRoute).toContain('const TITLE = "Gapwise for UTM"');
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
    expect(csp).toContain("https://accounts.google.com/gsi/client");
    expect(csp).toContain("connect-src 'self' blob:");
    expect(csp).not.toContain("connect-src *");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("public legal surfaces", () => {
  test("provide public, app-state-independent routes with titles", async () => {
    for (const [path, title] of [
      ["privacy", "Privacy — Gapwise for UTM"],
      ["terms", "Terms — Gapwise for UTM"],
    ]) {
      const source = await readFile(`src/routes/${path}.tsx`, "utf8");
      expect(source).toContain(`createFileRoute("/${path}")`);
      expect(source).toContain(title);
      expect(source).not.toContain("supabase");
      expect(source).not.toContain("useAuth");
    }
  });
});
