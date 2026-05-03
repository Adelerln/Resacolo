begin;

alter table public.invoices
drop constraint if exists invoices_invoice_type_check;

alter table public.invoices
add constraint invoices_invoice_type_check
check (
  invoice_type in (
    'ORDER',
    'CLIENT',
    'COLLECTIVITY',
    'ORGANIZER',
    'MNEMOS_PUBLICATION_PERIOD',
    'MNEMOS_COMMISSION_PERIOD'
  )
);

commit;
