import { describe, expect, test } from "bun:test";
import config from "../vercel.json";

type Header = { key: string; value: string };

function globalHeaders() {
  const rule = config.headers.find((entry) => entry.source === "/(.*)");
  if (!rule) throw new Error("global Vercel header rule is missing");
  return new Map((rule.headers as Header[]).map(({ key, value }) => [key, value]));
}

describe("deployment security headers", () => {
  test("keeps the browser security baseline fail-closed", () => {
    const headers = globalHeaders();

    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");

    const permissions = headers.get("Permissions-Policy") ?? "";
    expect(permissions).toContain("camera=()");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("payment=()");
    expect(permissions).toContain("usb=()");
  });

  test("keeps CSP restrictive around executable and embedding surfaces", () => {
    const csp = globalHeaders().get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).not.toMatch(/(?:^|;)\s*default-src\s+\*/);
    expect(csp).not.toMatch(/(?:^|;)\s*script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/(?:^|;)\s*script-src[^;]*'unsafe-eval'/);
    expect(csp).not.toMatch(/(?:^|;)\s*object-src\s+\*/);
  });
});
