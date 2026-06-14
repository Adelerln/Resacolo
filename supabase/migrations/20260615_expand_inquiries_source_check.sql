begin;

alter table public.inquiries
drop constraint if exists inquiries_source_check;

alter table public.inquiries
add constraint inquiries_source_check
check (
  source is null
  or source in (
    'CONTACT_FORM',
    'PLATFORM',
    'MNEMOS',
    'MNEMOS_TRANSFER'
  )
);

commit;
