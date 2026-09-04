begin;
select plan(11);

select has_table('private', 'operator_audit_log', 'operator audit log exists in private schema');
select has_table('private', 'system_events', 'system events exist in private schema');
select has_table('public', 'user_email_preferences', 'email preferences table exists');
select has_table('public', 'ai_access_events', 'AI access events table exists');

select policies_are(
  'public',
  'user_email_preferences',
  array[
    'users read own email preferences',
    'users create own email preferences',
    'users update own email preferences'
  ],
  'email preferences remain caller-owned'
);
select table_privs_are(
  'public',
  'user_email_preferences',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'authenticated users receive no delete privilege on email preferences'
);

select policies_are(
  'public',
  'ai_access_events',
  array['users read own ai access history'],
  'AI access history exposes only owner reads'
);
select table_privs_are(
  'public',
  'ai_access_events',
  'authenticated',
  array['SELECT'],
  'authenticated users cannot directly forge AI audit rows'
);

select has_trigger(
  'auth',
  'users',
  'initialize_gapwise_email_preferences',
  'new auth users receive an explicit non-marketing preference row'
);
select has_function(
  'public',
  'record_ai_access_event',
  array['text', 'text', 'text'],
  'caller-bound AI audit RPC exists'
);
select function_privs_are(
  'public',
  'record_ai_access_event',
  array['text', 'text', 'text'],
  'anon',
  array[]::text[],
  'anonymous callers cannot execute the AI audit RPC'
);

select * from finish();
rollback;
