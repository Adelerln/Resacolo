-- Nettoie les doublons d'enfants (même user + prénom + nom + date)
-- puis empêche les ré-insertions identiques.

do $$
begin
  if to_regclass('public.client_children') is null then
    raise notice 'skip: public.client_children missing';
    return;
  end if;

  delete from public.client_children child
  using public.client_children newer
  where child.user_id = newer.user_id
    and lower(trim(child.first_name)) = lower(trim(newer.first_name))
    and lower(trim(child.last_name)) = lower(trim(newer.last_name))
    and child.birthdate = newer.birthdate
    and (
      child.created_at > newer.created_at
      or (child.created_at = newer.created_at and child.id > newer.id)
    );
end
$$;

create unique index if not exists client_children_user_identity_uidx
  on public.client_children (
    user_id,
    lower(trim(first_name)),
    lower(trim(last_name)),
    birthdate
  );
