# Billing and Multi-Currency Cash

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-09, RN-07, RN-11, RN-16

Purpose: defines how clinics price services, invoice, take cash in three currencies at once, manage exchange rates, run cash drawers, pay doctors their share and report finances. The market is cash-first. Aleppo uses the new Syrian pound and Azaz mostly uses the Turkish lira, with US dollars common in both [RN-09 §1]. No Arabic clinic product documents mixed-currency cash handling, so this is a differentiator [RN-07 §3]. Built in **Phase A**. Dental treatment-plan installments reuse this model. Plan structure itself is in the dental domain doc.

Related: [scheduling and queue](scheduling-queue.md) · [platform](platform-and-configuration.md) · [ADR index](../adr/README.md) · [open decisions](../open-decisions.md)

## 1. Money primitives (ADR-0018)

- BIL-01 Money is stored as `{amount_minor: BIGINT, currency: ISO 4217}`. Floats are not allowed anywhere. Rate maths uses decimals with at least 10 decimal places [RN-09 §3, §9] [RN-16 §15].
- BIL-02 Release 1 supports three currencies: SYP (the new pound, with the "ليرة سورية جديدة" label), TRY and USD. Each branch enables the currencies it uses.
- BIL-03 Each tenant has a base currency, USD by default, used for consolidated reporting. It is locked after the first financial posting.
- BIL-04 Each currency has a cash unit and a rounding mode. Defaults: SYP 10.00, because the smallest new note is 10 [RN-09 §1]; TRY 1.00; USD 1.00. Rounding goes to the nearest unit, with ties resolved in the patient's favour.
- BIL-05 An import or rate entry that looks like old-pound scale (a ×100 pattern) is rejected with a hint, because the redenomination was 100:1 [RN-09 §1].

## 2. Exchange rates

- BIL-06 Exchange rates are managed by the clinic, per tenant with an optional branch override. Each rate has a **receive rate** (used when the clinic takes a foreign currency), a **give rate** (used when it gives change or refunds), the time it takes effect, its source (manual / override), the author and a reason. Rates are stored append-only with full history [RN-09 §4].
- BIL-07 Clinics can set rates several times a day. The current rate is the latest one whose effective time is not in the future.
- BIL-08 Rate guards:
  - A rate older than the staleness limit (default 24 h) shows a warning.
  - With no rate set today, foreign-currency payments are blocked unless a permitted user overrides.
  - A change larger than ±10% needs confirmation.
- BIL-09 A rate override on a single transaction needs the `rate.override` permission, a reason and a maximum allowed deviation, and is audited.
- BIL-10 The Central Bank of Syria reference rate is shown for comparison only. It is shown only when a reliable feed exists, which is not yet confirmed [RN-09 §9].
- BIL-11 Automatic scraping of market rates (Later).

## 3. Prices and invoices

- BIL-12 Each price-list item carries its own currency. For example, consultations can be priced in SYP and implants in USD. The UI shows the equivalent amounts at the current receive rate.
- BIL-13 An invoice uses one currency, the pricing currency. Lines are converted into it when the invoice is created, using a rate snapshot. Mixed-currency lines on one invoice are not supported in Release 1.
- BIL-14 The patient's balance stays in the invoice currency, so swings in the exchange rate never erode a receivable.
- BIL-15 Discounts apply at line or invoice level. Above a clinic threshold they need a permission and a reason.
- BIL-16 A quote or treatment plan can carry an optional "rate guaranteed until" date.
- BIL-17 Invoices and payments are never hard-deleted. They are voided with a reason and an audit entry.

## 4. Receipts (mixed-currency payments)

- BIL-18 One receipt can hold several tender lines, each in its own currency, plus change lines. Each line stores its currency, amount, the rate used, the rate record and the equivalent in the invoice currency and the base currency [RN-09 §5, §9].
- BIL-19 The payment algorithm:
  1. Convert each incoming tender to the invoice currency at the receive rate, at full precision.
  2. Compute the remaining or over-paid amount.
  3. If over-paid, the cashier chooses the change currency (or currencies). Change is converted at the give rate and rounded to that currency's cash unit. The leftover of at most half a unit goes to a rounding line or, by the patient's choice, to a patient credit.
  4. If under-paid, the invoice stays partially paid and the remaining amount is shown in every enabled currency.
- BIL-20 Partial payments, deposits (عربون) and patient credit are supported. Credit is held in the base currency with its rate stored.
- BIL-21 Installment schedules are supported: a down payment plus dated installments in the plan's currency. Each installment is paid with a normal receipt at that day's rate. Overdue installments are flagged.
- BIL-22 Refunds are change-direction lines at the give rate. They need a permission and can never exceed the amount paid.
- BIL-23 Release 1 accepts cash in all three currencies. Non-cash methods (bank transfer, e-wallets) can be recorded as SYP tenders without integration (Later: integrations).

## 5. Cash sessions

- BIL-24 Each cashier works in a cash session per branch, with a separate balance per currency: opening float, expected amount, counted amount and difference, with an optional count by denomination.
- BIL-25 Cash movements are typed: sale, refund, expense, deposit to safe and float adjustment. Each is recorded per currency.
- BIL-26 The close is blind: the cashier counts before seeing the expected amount. A difference above the clinic threshold needs manager approval. Differences are never netted across currencies.
- BIL-27 The Z-report prints the daily close per currency.
- BIL-28 Simple expenses are paid out of a cash session, with a category and an optional attachment.
- BIL-29 When the drawer may not have enough of a currency to give change, a warning appears, based on the live expected balance.

## 6. Receipts printing

- BIL-30 Arabic RTL receipts (thermal 58/80 mm and A5) show:
  - every tender and change line with its currency and rate;
  - the rounding line;
  - the remaining balance or credit;
  - a footer listing the rates in effect and their timestamp [RN-09 §8].
- BIL-31 SYP display mode, a tenant setting, shows prices and receipts primarily in SYP while internal accounting is unchanged. It covers jurisdictions that require SYP-only display (OD-09) [RN-09 §9].

## 7. Doctor share (commission)

- BIL-32 Each practitioner has a commission rule: a percentage of collections. Collections-based rules are the Release 1 default, and other bases are Later. The rule optionally deducts lab costs, fully or by percentage, and has an effective-from date [RN-07 §9].
- BIL-33 Payments are allocated to charges, and the allocation drives collections-based commission.
- BIL-34 A monthly commission statement per doctor is computed on base-currency equivalents at tender rates. It is paid in a chosen currency at the payout give rate, and the statement is locked after approval.
- BIL-35 Local commission and installment norms must be validated in the field before defaults are fixed (OD-08).

## 8. Reports

- BIL-36 These reports are available:
  - daily cash close per currency;
  - revenue and collections by doctor, branch and period;
  - receivables and aging;
  - installments due and overdue;
  - rounding and spread summary;
  - expenses;
  - commission statements.
- BIL-37 Reports are produced in a reporting currency chosen at query time, using the rates stored at each transaction and never today's rate.
- BIL-38 Every report exports to Excel and PDF.
- BIL-39 A full double-entry ledger with realised and unrealised FX postings (Later). The data captured in Release 1 must be enough to produce it.
- BIL-40 IAS 29 hyperinflation restatement and a standalone currency-exchange desk are out of scope.

## Key entities

- `currency_setting`: enabled currencies, cash unit and rounding per tenant/branch.
- `exchange_rate`: append-only receive/give rates with effective time and source.
- `reference_rate`: platform-wide Central Bank / market reference, display only.
- `price_list`, `price_list_item`: per-currency service prices.
- `invoice`, `invoice_line`: single-currency invoice with a rate snapshot and base total.
- `receipt`, `receipt_line`: mixed tender and change lines with the rates used.
- `payment_allocation`: links receipt amounts to charges, for balances and commission.
- `installment_schedule`, `installment`: plan financing.
- `patient_credit`: credit held in base currency.
- `cash_session`, `cash_session_balance`, `cash_movement`: per-cashier, per-currency drawer.
- `expense`: categorised cash-out.
- `commission_rule`, `commission_statement`: doctor share.

## Verification notes

- A worked rounding example is a golden test: an invoice of 1,000,000 SYP is paid with 50 USD and 200 TRY at stored rates, with change in SYP rounded to 10, and the rounding line is ≤ 5 SYP.
- A property-based test checks that, for random tenders and rates, the sum of all receipt lines in invoice currency plus rounding equals the amount applied, with no floating-point drift.
- A rate-guard test checks the stale-rate warning, the block when no rate is set, the confirmation above ±10% and the ×100 rejection.
- A cash-close test checks that differences are computed per currency and never netted.
- A void test checks that a voided payment remains in history and reports exclude it.
- A commission test reproduces a sample month by hand and checks it matches the generated statement.
- A historical-rate test checks that a report re-run after a rate change gives identical results.
