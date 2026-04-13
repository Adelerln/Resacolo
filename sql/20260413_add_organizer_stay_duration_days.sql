alter table public.organizers
  add column if not exists stay_duration_min_days integer,
  add column if not exists stay_duration_max_days integer;
