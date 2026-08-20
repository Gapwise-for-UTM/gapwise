# Founder entitlement administration

After the entitlement migration is applied, a Supabase project administrator can grant permanent
founder access in the SQL editor. Replace the placeholder with the account's verified `auth.users`
UUID; do not use an email address or expose this statement to the browser.

```sql
insert into public.user_entitlements (user_id, tier, source, expires_at)
values ('<AUTH_USER_UUID>'::uuid, 'founder', 'founder_grant', null)
on conflict (user_id) do update
set tier = 'founder', source = 'founder_grant', expires_at = null, updated_at = now();
```

Absence of a row means `free`. The authenticated browser can select only its own row. All writes
remain reserved to a database administrator or service-role connection.
