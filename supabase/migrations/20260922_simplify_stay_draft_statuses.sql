-- Un séjour importé reste un brouillon jusqu'à la réussite de sa publication.
-- Cette migration normalise les anciens statuts intermédiaires.
update public.stay_drafts
set status = case
  when nullif(trim(coalesce(raw_payload #>> '{live_publication,stay_id}', '')), '') is not null
    then 'published'
  else 'draft'
end
where lower(trim(status)) = 'validated';
