import { describe, expect, test } from "bun:test";
import {
  MAX_PROVIDER_DESCRIPTION_LENGTH,
  normalizeProviderDescription,
} from "@/features/academic/provider-adapter";

describe("provider description text boundary", () => {
  test("preserves deterministic block and nested text", () => {
    expect(
      normalizeProviderDescription(
        "<p>Complete <strong>Questions 1–5</strong>.</p><ul><li>Show your work.</li><li>Submit before Friday.</li></ul>",
      ),
    ).toBe("Complete Questions 1–5.\nShow your work.\nSubmit before Friday.");
  });

  test("decodes entities exactly once and leaves encoded markup inert", () => {
    expect(normalizeProviderDescription("A &amp; B &lt; C &#x1F680; &amp;lt;script&amp;gt;")).toBe(
      "A & B < C 🚀 &lt;script&gt;",
    );
    expect(normalizeProviderDescription("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(
      "<script>alert(1)</script>",
    );
  });

  test("drops script, style, comments, and tag attributes without executing content", () => {
    expect(
      normalizeProviderDescription(
        "safe<script>alert(1)</script><style>body{}</style><!-- secret --><img src=x onerror=alert(1)>end",
      ),
    ).toBe("safeend");
  });

  test("handles breaks, malformed fragments, Unicode, and bounds huge input", () => {
    expect(normalizeProviderDescription("one<br>two<div>中文 &amp; café<broken")).toBe(
      "one\ntwo\n中文 & café<broken",
    );
    const result = normalizeProviderDescription(`<p>${"x".repeat(1_000_000)}</p>`)!;
    expect(result.length).toBeLessThanOrEqual(MAX_PROVIDER_DESCRIPTION_LENGTH);
    expect(result.length).toBeGreaterThan(MAX_PROVIDER_DESCRIPTION_LENGTH - 10);
  });
});
