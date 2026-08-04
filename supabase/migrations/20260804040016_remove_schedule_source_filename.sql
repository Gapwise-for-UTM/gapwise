-- Deploy the compatible frontend before applying this migration so older clients
-- do not continue sending a column that no longer exists.
alter table if exists public.user_schedules
  drop column if exists source_filename;
