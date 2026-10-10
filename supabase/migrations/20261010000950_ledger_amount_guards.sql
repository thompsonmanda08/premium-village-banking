-- No writer, privileged or not, may store NaN or an amount past numeric(12,2): an approved NaN entry would be
-- permanent (the ledger is append-only) and turn every sum into NaN.
alter table public.declarations
  add constraint declarations_saving_finite check (saving <> 'NaN'::numeric and saving < 10000000000),
  add constraint declarations_loan_repayment_finite check (loan_repayment <> 'NaN'::numeric and loan_repayment < 10000000000),
  add constraint declarations_excess_finite check (excess <> 'NaN'::numeric and excess < 10000000000),
  add constraint declarations_membership_finite check (membership <> 'NaN'::numeric and membership < 10000000000),
  add constraint declarations_penalty_finite check (penalty <> 'NaN'::numeric and penalty < 10000000000),
  add constraint declarations_txn_fee_finite check (txn_fee <> 'NaN'::numeric and txn_fee < 10000000000),
  add constraint declarations_borrowing_request_finite check (borrowing_request <> 'NaN'::numeric and borrowing_request < 10000000000);
alter table public.entries
  add constraint entries_amount_finite check (amount <> 'NaN'::numeric and amount < 10000000000);
alter table public.loans
  add constraint loans_principal_finite check (principal <> 'NaN'::numeric and principal < 10000000000),
  add constraint loans_interest_finite check (interest <> 'NaN'::numeric and interest < 10000000000);
alter table public.loan_instalments
  add constraint loan_instalments_amount_due_finite check (amount_due <> 'NaN'::numeric and amount_due < 10000000000);
