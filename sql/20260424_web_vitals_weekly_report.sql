-- Rapport hebdomadaire p75 Core Web Vitals par template de page.
-- À exécuter dans Supabase SQL editor ou via psql.

select
  date_trunc('week', created_at)::date as week_start,
  page_template,
  metric_name,
  percentile_cont(0.75) within group (order by metric_value) as p75_value,
  round(avg((within_budget is true)::int)::numeric, 4) as within_budget_ratio,
  count(*) as sample_size
from public.web_vitals_events
where created_at >= now() - interval '12 weeks'
group by 1, 2, 3
order by week_start desc, page_template, metric_name;
