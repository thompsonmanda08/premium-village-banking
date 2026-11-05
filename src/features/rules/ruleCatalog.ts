export type RuleBasis = 'as_written' | 'differs' | 'not_in_constitution';

export type CatalogRule = {
  key: string;
  title: string;
  text: string;
  clause: string | null;
  basis: RuleBasis;
};

// The rules the app applies. `basis` says how each sits against the constitution.
export const RULE_CATALOG: CatalogRule[] = [
  {
    key: 'saving_minimum',
    title: 'Monthly saving',
    text: 'Each member saves at least K250 a month. There is no upper limit. A month that falls short is tracked as a shortfall.',
    clause: 'Savings',
    basis: 'as_written',
  },
  {
    key: 'loan_interest',
    title: 'Loan interest',
    text: 'A loan carries 15% simple interest, charged once on the amount borrowed. It does not grow month by month, and repaying early does not reduce it.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'loan_terms',
    title: 'How long a loan runs',
    text: 'Up to K3,000 is repaid in 1 month, up to K5,000 in 2 months, up to K10,000 in 3 months, and K10,000 or more in 4 months. The bands are as the constitution sets them, except exactly K10,000: the constitution lists it in two bands and the app puts it in the 4-month band. The constitution is silent on a member with more than one loan, so each loan is repaid by its own instalments, set when the loan is given.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'loan_cap',
    title: 'How much a member can borrow',
    text: 'A loan may be up to 3 times your savings in the first 4 months of the cycle, 2 times from the fifth month, and 1 time in the last 3 months of the cycle, which begin in November 2026. Savings are counted as built up to date.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'no_loans_last_month',
    title: 'No new loans in the final month',
    text: 'The last month of the cycle is for repaying loans only. No new loans are given then.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'excess_charge',
    title: 'Charge on money not lent out',
    text: 'Money that is not borrowed is charged 10% and the charge is shared by all members according to their savings. The constitution says this, but not how often, so the app charges it every month.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'minimum_payable',
    title: 'Minimum to pay each month',
    text: 'The app shows a minimum for the month: the loan instalments due, the charge on money not lent out, and anything missed from earlier months. It is a guide, and the treasurer can change it with a reason. The constitution has no such rule.',
    clause: null,
    basis: 'not_in_constitution',
  },
  {
    key: 'payment_order',
    title: 'Where a payment goes first',
    text: 'When a member pays, the money is applied in this order: the charge on money not lent out, then penalties, then loan interest, then the loan itself. The constitution is silent on the order.',
    clause: null,
    basis: 'not_in_constitution',
  },
  {
    key: 'penalty_basis',
    title: 'Late payment penalty',
    text: 'A declaration or payment after the 7th costs K50 for each day it is late. The constitution says a flat K50. The treasurer can waive the penalty with a reason, for example when the phone limit blocks a payment.',
    clause: 'Savings',
    basis: 'differs',
  },
  {
    key: 'membership_fee',
    title: 'Membership fee',
    text: 'The membership fee is K50 each quarter, due in February, May, August and November. It pays for hosting meetings and is kept apart from the lending money and interest. The constitution sets the fee and its purpose but does not name the months, so the months were chosen by the group.',
    clause: 'Membership',
    basis: 'as_written',
  },
  {
    key: 'deadlines_and_extensions',
    title: 'Deadlines and extensions',
    text: 'Declarations and payments are made between the 5th and 7th of each month. The constitution sets the same window and a penalty for anything after the 7th, but says nothing about moving the deadline. The group can move the deadline for a month, and the app then charges no penalty up to the new date.',
    clause: 'Savings',
    basis: 'differs',
  },
  {
    key: 'default_handling',
    title: 'When a member defaults',
    text: 'A member in default can only withdraw their own savings, and the interest on those savings goes to the group. The first part is as the constitution says. The constitution does not say when a member counts as in default or whether the unpaid loan is taken off their savings.',
    clause: 'Article 5, Loan Management',
    basis: 'as_written',
  },
  {
    key: 'payout_and_pots',
    title: 'Payout and the money pots',
    text: 'The constitution gives the payout date, 6 February 2027, and the app uses it. Interest is shared by each month\'s savings. Transfer fees for the payout come from the fees members declare. The constitution does not say how interest is shared, who pays the fees or what happens to leftover pots.',
    clause: null,
    basis: 'not_in_constitution',
  },
];
