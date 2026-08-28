import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const policyPath = "src/routes/security.tsx";
const securityTxtPath = "public/.well-known/security.txt";

describe("public vulnerability disclosure contract", () => {
  test("security.txt has required RFC 9116 fields and agrees with the policy", async () => {
    const [policy, securityTxt] = await Promise.all([
      readFile(policyPath, "utf8"),
      readFile(securityTxtPath, "utf8"),
    ]);

    expect(securityTxt).toContain("Canonical: https://gapwise.ca/.well-known/security.txt");
    expect(securityTxt).toContain("Policy: https://gapwise.ca/security");
    expect(securityTxt).toContain("Preferred-Languages: en");

    const contact = securityTxt.match(/^Contact: (https:\/\/github\.com\/[^\n]+)$/m)?.[1];
    expect(contact).toBeTruthy();
    expect(policy).toContain(contact!);

    const expires = securityTxt.match(/^Expires: (.+)$/m)?.[1];
    expect(expires).toBeTruthy();
    expect(Number.isNaN(Date.parse(expires!))).toBe(false);
    expect(Date.parse(expires!)).toBeGreaterThan(Date.parse("2027-02-28T00:00:00Z"));
  });

  test("policy preserves reporting and legal-review boundaries", async () => {
    const policy = await readFile(policyPath, "utf8");
    expect(policy).toContain("operational goals, not guaranteed");
    expect(policy).toContain("requires human and legal review");
    expect(policy).toContain("does not currently operate a bug-bounty");
    expect(policy).toContain(
      "does not describe this design as end-to-end encrypted or zero knowledge",
    );
  });
});
