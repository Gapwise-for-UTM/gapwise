# Retired migration artifacts

These SQL files are preserved for audit/history only. They are intentionally outside `supabase/migrations` and must not be applied automatically by the Supabase CLI.

- `20260821125500_add_onboarding_and_stripe_billing.sql` was never recorded in production. Its still-required onboarding state is preserved by `20260829062608_retire_legacy_billing_schema.sql`; its Stripe tables are retired and must not be recreated.
- `20260824140000_campus_community_state.sql` was never recorded in production, and the corresponding crowd/publisher schema is not deployed. Keep it archival unless the feature is deliberately redesigned and shipped through a new forward migration.
- `20260903115000_allow_operator_mail_deletion.sql` was never recorded in production, although production already has the resulting `DELETE` privilege. Active migration history reconciles that state through a new forward, idempotent migration instead.

Production `supabase_migrations.schema_migrations` is authoritative for migrations that actually executed. Do not move these files back into the active migration directory or mark their historical versions as applied without independently verifying the schema state.
