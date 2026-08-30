begin;

create extension if not exists pgtap with schema extensions;
select plan(1);

select ok(
  (
    select pg_get_constraintdef(oid) ~ 'schema_version.*(1.*2|2.*1)'
    from pg_constraint
    where conrelid = 'public.encrypted_private_data'::regclass
      and conname = 'encrypted_private_data_schema_version'
  ),
  'encrypted private data accepts schema versions 1 and 2'
);

select * from finish();
rollback;
