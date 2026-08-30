import { describe, expect, test } from "bun:test";
import { redactSensitiveLogText } from "@/lib/log-redaction";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.signature0123456789";

describe("server log redaction", () => {
  test("redacts bearer tokens, JWTs, and cookie headers", () => {
    const text = [
      "Authorization: Bearer super-secret-bearer",
      `jwt=${JWT}`,
      "Cookie: sb-project-auth-token=refresh-secret; theme=dark",
      "Set-Cookie: session=server-secret; HttpOnly; Secure",
    ].join("\n");

    const redacted = redactSensitiveLogText(text);

    expect(redacted).not.toContain("super-secret-bearer");
    expect(redacted).not.toContain(JWT);
    expect(redacted).not.toContain("refresh-secret");
    expect(redacted).not.toContain("server-secret");
    expect(redacted).toContain("[REDACTED]");
  });

  test("redacts named secrets in JSON and diagnostic key-value text", () => {
    const text = [
      '{"access_token":"access-value","refresh_token":"refresh-value"}',
      "client_secret=client-value api_key:api-value password=hunter2",
      '"service_role_key":"service-role-value"',
      '"sb-demo-auth-token":"browser-session-value"',
    ].join("\n");

    const redacted = redactSensitiveLogText(text);

    for (const secret of [
      "access-value",
      "refresh-value",
      "client-value",
      "api-value",
      "hunter2",
      "service-role-value",
      "browser-session-value",
    ]) {
      expect(redacted).not.toContain(secret);
    }
  });

  test("preserves ordinary stack and status diagnostics", () => {
    const text = "Error: route calculation failed\n    at planRoute (routing.ts:42:7) (status 502)";
    expect(redactSensitiveLogText(text)).toBe(text);
  });
});
