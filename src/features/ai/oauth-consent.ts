type AuthorizationResponse = {
  data: { redirect_url?: string | null } | null;
  error: unknown | null;
};

type FinalizeOAuthApprovalInput = {
  authorizationId: string;
  clientId: string;
  clientName: string;
  approveAuthorization: (authorizationId: string) => Promise<AuthorizationResponse>;
  approveClient: (clientId: string, clientName: string) => Promise<{ created: boolean }>;
  revokeClient: (clientId: string) => Promise<unknown>;
  revokeGrant: (input: { clientId: string }) => Promise<unknown>;
};

/**
 * Bind the exact Gapwise AI client before asking Supabase to approve OAuth.
 *
 * Gapwise's custom access-token hook grants the MCP resource audience only when
 * the exact user/client pair already exists in ai_oauth_clients at token
 * issuance. Some OAuth clients can complete token issuance immediately around
 * approval, so binding after approveAuthorization creates a race where a valid
 * OAuth session receives a token that Gapwise AI must reject.
 *
 * The binding happens only after the user clicks Allow. If Supabase approval
 * then fails, a newly-created binding is removed best-effort. Existing bindings
 * are never removed by a failed re-authorization attempt. If Supabase accepted
 * approval but returned an unusable response, both the new binding and OAuth
 * grant are rolled back best-effort before surfacing the original error.
 */
export async function finalizeOAuthApproval({
  authorizationId,
  clientId,
  clientName,
  approveAuthorization,
  approveClient,
  revokeClient,
  revokeGrant,
}: FinalizeOAuthApprovalInput): Promise<string> {
  const clientApproval = await approveClient(clientId, clientName);
  let oauthAccepted = false;

  try {
    const response = await approveAuthorization(authorizationId);
    if (response.error) throw response.error;
    if (response.data) oauthAccepted = true;
    if (!response.data?.redirect_url) {
      throw new Error("OAuth redirect was missing.");
    }
    return response.data.redirect_url;
  } catch (error) {
    if (clientApproval.created) {
      try {
        await revokeClient(clientId);
      } catch {
        // Preserve the original OAuth failure. The targeted rollback is
        // best-effort and never touches other approved AI clients.
      }
    }
    if (oauthAccepted) {
      try {
        await revokeGrant({ clientId });
      } catch {
        // Preserve the original OAuth failure after best-effort grant cleanup.
      }
    }
    throw error;
  }
}
