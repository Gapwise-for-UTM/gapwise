import { describe, expect, test } from "bun:test";
import { finalizeOAuthApproval } from "../src/features/ai/oauth-consent";

describe("Gapwise AI OAuth consent finalization", () => {
  test("does not approve the Gapwise AI client when OAuth approval fails", async () => {
    let clientApprovals = 0;

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-1",
        clientId: "client-1",
        clientName: "Test client",
        approveAuthorization: async () => ({ data: null, error: new Error("approval failed") }),
        approveClient: async () => {
          clientApprovals += 1;
        },
        revokeGrant: async () => undefined,
      }),
    ).rejects.toThrow("approval failed");

    expect(clientApprovals).toBe(0);
  });

  test("binds the exact AI client only after OAuth approval and before redirect", async () => {
    const events: string[] = [];

    const redirectUrl = await finalizeOAuthApproval({
      authorizationId: "authorization-2",
      clientId: "client-2",
      clientName: "Trusted client",
      approveAuthorization: async () => {
        events.push("oauth-approved");
        return {
          data: { redirect_url: "https://client.example/callback?code=short-lived" },
          error: null,
        };
      },
      approveClient: async () => {
        events.push("client-bound");
      },
      revokeGrant: async () => {
        events.push("grant-revoked");
      },
    });

    expect(events).toEqual(["oauth-approved", "client-bound"]);
    expect(redirectUrl).toBe("https://client.example/callback?code=short-lived");
  });

  test("withholds the redirect and revokes the grant when AI client binding fails", async () => {
    const events: string[] = [];

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-3",
        clientId: "client-3",
        clientName: "Broken client",
        approveAuthorization: async () => {
          events.push("oauth-approved");
          return {
            data: { redirect_url: "https://client.example/callback?code=do-not-deliver" },
            error: null,
          };
        },
        approveClient: async () => {
          events.push("client-binding-failed");
          throw new Error("binding failed");
        },
        revokeGrant: async ({ clientId }) => {
          events.push(`grant-revoked:${clientId}`);
        },
      }),
    ).rejects.toThrow("binding failed");

    expect(events).toEqual(["oauth-approved", "client-binding-failed", "grant-revoked:client-3"]);
  });

  test("still fails closed when rollback itself is unavailable", async () => {
    let redirected = false;

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-4",
        clientId: "client-4",
        clientName: "Client",
        approveAuthorization: async () => ({
          data: { redirect_url: "https://client.example/callback?code=browser-held" },
          error: null,
        }),
        approveClient: async () => {
          throw new Error("binding failed");
        },
        revokeGrant: async () => {
          throw new Error("rollback failed");
        },
      }).then(() => {
        redirected = true;
      }),
    ).rejects.toThrow("binding failed");

    expect(redirected).toBe(false);
  });
});
