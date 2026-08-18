-- Remove the obsolete generic OAuth resource hook from the interrupted staging
-- pass. The approved user/client audience hook is the sole supported hook.
drop function if exists public.custom_access_token_hook(jsonb);

comment on function public.gapwise_ai_access_token_hook(jsonb) is
  'Only supported Gapwise AI custom access-token hook. Binds an OAuth token to https://ai.gapwise.ca/api/mcp only when the exact user/client pair was approved in ai_oauth_clients before token issuance.';
