# ADR-0018: Money — three currencies, integer minor units, clinic-managed rates, mixed-currency receipts, per-currency cash sessions

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The owner requires the new Syrian pound (SYP, redenominated 100:1 from January 2026), the Turkish lira (TRY, dominant in Azaz) and the US dollar (USD), with professional exchange-rate handling and payments of one invoice in several currencies. The smallest SYP note is 10; official (CBS) and market rates diverge; merchants re-price within a day; small notes are scarce [RN-09 §1–§2]. Standard POS systems do not support mixed-currency tenders per order [RN-09 §3].

## Decision
- `Money { amountMinor: bigint, currency: 'SYP' | 'TRY' | 'USD' }`; no floats; conversions with decimal math (decimal.js) and NUMERIC rate columns.
- Currency settings per clinic/branch: enabled, cash rounding unit (SYP 10.00, TRY 1.00, USD 1.00), Arabic display name.
- Base currency per clinic (default USD), locked after the first posting; report currency chosen at query time.
- Exchange rates are clinic-managed and append-only: receive rate, give rate, effective-from timestamp, source, author, optional reason; several per day allowed. Guards: stale > 24 h warning, change > ±10% confirmation, ×100 pattern rejected (old-pound mistake). CBS reference rates are displayed for comparison only. Per-transaction overrides need a permission and a reason, and are audited.
- Price-list items carry their own currency. An invoice is in its pricing currency; mixed-currency lines on one invoice are not supported in Release 1. Balances stay in invoice currency.
- A receipt has tender, change, refund and credit lines, each with currency, rate used and base equivalent. Full-precision maths, one final cash rounding; the residue goes to a rounding line or to patient credit. Installments are multiple receipts at the rate of the payment day. Refunds need a permission.
- Cash sessions per cashier per currency: opening float, movements, blind count, difference, manager approval above a threshold, daily close (Z report). No cross-currency netting.
- Reports use the rates stored on each transaction. Doctor share is computed on base equivalents of collections.
- An "SYP display mode" can show prices and receipts primarily in SYP if regulation requires (OD-09).
- Out of Release 1: full double-entry GL with FX postings (data is captured to add it later), card/wallet integrations.

## Consequences
+ Correct, auditable multi-currency cash handling — a differentiator no competitor documents.
− More complex cashier UX; requires careful design and tests.

## Alternatives considered
- Single currency with conversion at display: hides real cash per currency; rejected.
- Floats or per-row decimal strings: precision bugs.

## Sources
[RN-09 §1–§9], [RN-07 §3, §9], [RN-16 §15], [RN-03 §4]
