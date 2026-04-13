begin;

alter table public.accommodations
drop constraint if exists accommodations_status_check;

alter table public.accommodations
add constraint accommodations_status_check
check (status in ('DRAFT', 'TO_VALIDATE', 'VALIDATED', 'ARCHIVED'));

commit;
