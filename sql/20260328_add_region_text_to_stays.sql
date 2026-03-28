alter table public.stays
add column if not exists region_text text;

create index if not exists stays_region_text_idx on public.stays (region_text);
