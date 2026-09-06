import { describe, expect, test } from "bun:test";
import { finalizeOAuthApproval } from "../src/features/ai/oauth-consent";

describe("Gapwise AI OAuth consent finalization", () => {
  test("binds the exact AI client before OAuth approval", async () => {
    const events: string[] = [];

    const redirectUrl = await finalizeOAuthApproval({
      authorizationId: "authorization-1",
      clientId: "client-1",
      clientName: "Trusted client",
      approveClient: async () => {
        events.push("client-bound");
        return { created: true };
      },
      approveAuthorization: async () => {
        events.push("oauth-approved");
        return {
          data: { redirect_url: "https://client.example/callback?code=short-lived" },
          error: null,
        };
      },
      revokeClient: async () => {
        events.push("client-revoked");
      },
      revokeGrant: async () => {
        events.push("grant-revoked");
      },
    });

    expect(events).toEqual(["client-bound", "oauth-approved"]);
    expect(redirectUrl).toBe("https://client.example/callback?code=short-lived");
  });

  test("does not touch OAuth when the Gapwise AI client binding fails", async () => {
    let oauthApprovals = 0;

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-2",
        clientId: "client-2",
        clientName: "Broken client",
        approveClient: async () => {
          throw new Error("binding failed");
        },
        approveAuthorization: async () => {
          oauthApprovals += 1;
          return { data: null, error: null };
        },
        revokeClient: async () => undefined,
        revokeGrant: async () => undefined,
      }),
    ).rejects.toThrow("binding failed");

    expect(oauthApprovals).toBe(0);
  });

  test("rolls back a newly-created AI binding when OAuth approval fails", async () => {
    const events: string[] = [];

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-3",
        clientId: "client-3",
        clientName: "Client",
        approveClient: async () => {
          events.push("client-bound");
          return { created: true };
        },
        approveAuthorization: async () => {
          events.push("oauth-failed");
          return { data: null, error: new Error("approval failed") };
        },
        revokeClient: async (clientId) => {
          events.push(`client-revoked:${clientId}`);
        },
        revokeGrant: async () => {
          events.push("grant-revoked");
        },
      }),
    ).rejects.toThrow("approval failed");

    expect(events).toEqual(["client-bound", "oauth-failed", "client-revoked:client-3"]);
  });

  test("preserves an existing AI binding when re-authorization fails", async () => {
    const events: string[] = [];

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-4",
        clientId: "client-4",
        clientName: "Existing client",
        approveClient: async () => ({ created: false }),
        approveAuthorization: async () => ({ data: null, error: new Error("approval failed") }),
        revokeClient: async () => {
          events.push("client-revoked");
        },
        revokeGrant: async () => {
          events.push("grant-revoked");
        },
      }),
    ).rejects.toThrow("approval failed");

    expect(events).toEqual([]);
  });

  test("revokes both authorities when OAuth is accepted without a usable redirect", async () => {
    const events: string[] = [];

    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-5",
        clientId: "client-5",
        clientName: "Client",
        approveClient: async () => ({ created: true }),
        approveAuthorization: async () => ({ data: {}, error: null }),
        revokeClient: async (clientId) => {
          events.push(`client-revoked:${clientId}`);
        },
        revokeGrant: async ({ clientId }) => {
          events.push(`grant-revoked:${clientId}`);
        },
      }),
    ).rejects.toThrow("OAuth redirect was missing.");

    expect(events).toEqual(["client-revoked:client-5", "grant-revoked:client-5"]);
  });

  test("preserves the original OAuth error when rollback itself fails", async () => {
    await expect(
      finalizeOAuthApproval({
        authorizationId: "authorization-6",
        clientId: "client-6",
        clientName: "Client",
        approveClient: async () => ({ created: true }),
        approveAuthorization: async () => ({ data: null, error: new Error("approval failed") }),
        revokeClient: async () => {
          throw new Error("client rollback failed");
        },
        revokeGrant: async () => {
          throw new Error("grant rollback failed");
        },
      }),
    ).rejects.toThrow("approval failed");
  });
});
