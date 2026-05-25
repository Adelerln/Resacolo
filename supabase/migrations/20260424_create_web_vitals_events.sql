create table if not exists public.web_vitals_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null,
  page_template text not null,
  metric_name text not null check (metric_name in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  metric_value double precision not null,
  rating text check (rating in ('good', 'needs-improvement', 'poor')),
  navigation_type text,
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop')),
  connection_type text,
  within_budget boolean,
  budget_target double precision,
  user_agent text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists web_vitals_events_created_at_idx
  on public.web_vitals_events (created_at desc);

create index if not exists web_vitals_events_route_metric_idx
  on public.web_vitals_events (route, metric_name, created_at desc);

create index if not exists web_vitals_events_template_metric_idx
  on public.web_vitals_events (page_template, metric_name, created_at desc);

create index if not exists web_vitals_events_metric_within_budget_idx
  on public.web_vitals_events (metric_name, within_budget, created_at desc);

