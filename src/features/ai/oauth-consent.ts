type AuthorizationResponse = {
  data: { redirect_url?: string | null } | null;
  error: unknown | null;
};

type FinalizeOAuthApprovalInput = {
  authorizationId: string;
  clientId: string;
  clientName: string;
  approveAuthorization: (authorizationId: string) => Promise<AuthorizationResponse>;
  approveClient: (clientId: string, clientName: string) => Promise<void>;
  revokeGrant: (input: { clientId: string }) => Promise<unknown>;
};

/**
 * Finalize an OAuth approval without widening Gapwise AI authority before the
 * OAuth server has successfully accepted the user's consent decision.
 *
 * Supabase's OAuth server creates the short-lived authorization code when
 * approveAuthorization succeeds, but the third-party client cannot receive or
 * exchange that code until this function returns its redirect URL and the UI
 * navigates there. We therefore bind the exact client to Gapwise AI only after
 * that success and before navigation.
 *
 * If the Gapwise-side client binding fails, revoke the OAuth grant best-effort
 * and never return the redirect URL. This keeps the client from receiving the
 * generated code through the consent UI on a partially completed approval.
 */
export async function finalizeOAuthApproval({
  authorizationId,
  clientId,
  clientName,
  approveAuthorization,
  approveClient,
  revokeGrant,
}: FinalizeOAuthApprovalInput): Promise<string> {
  const response = await approveAuthorization(authorizationId);
  if (response.error || !response.data?.redirect_url) {
    throw response.error ?? new Error("OAuth redirect was missing.");
  }

  try {
    await approveClient(clientId, clientName);
  } catch (error) {
    try {
      await revokeGrant({ clientId });
    } catch {
      // The authorization code remains browser-held because we do not return
      // its redirect URL. Gapwise AI RLS also remains fail-closed without the
      // client approval row. Preserve the original binding error for the UI.
    }
    throw error;
  }

  return response.data.redirect_url;
}
