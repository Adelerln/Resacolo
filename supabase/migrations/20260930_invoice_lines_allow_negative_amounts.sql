-- Client travel invoices store VACAF / partner deductions as negative line amounts.
alter table public.invoice_lines
  drop constraint if exists invoice_lines_amount_cents_check;
