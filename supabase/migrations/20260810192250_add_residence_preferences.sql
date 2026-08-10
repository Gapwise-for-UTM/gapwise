-- Residence choice is optional and belongs to the existing private preference row.
-- It is never inferred from a timetable or device location.

alter table public.user_preferences
  add column day_origin text not null default 'commute',
  add column residence_building_code text null,
  add constraint user_preferences_day_origin
    check (day_origin in ('commute', 'residence')),
  add constraint user_preferences_residence_building
    check (
      (day_origin = 'commute' and residence_building_code is null)
      or
      (day_origin = 'residence' and residence_building_code in (
        'EH', 'LL', 'MV', 'MC', 'OPH', 'PP', 'RIH', 'SW', 'NRB'
      ))
    );
