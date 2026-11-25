# A-02 screen-to-API contract

Status: Draft, filled and approved in [A-02-01](../../slices/A-02-01-design-and-screen-contract.md) · Date: 2026-11-25 · Owner: product owner
Companion of [spec A-02](A-02-settings-entitlements-console.md) (ADR-0047, OD-117). Rows are added by the design slice from the approved drawings. After approval a row changes only in the slice that owns it, with the drawing updated and the owner told.

## How to read and use it
- One row per screen and state. A route used by several screens is listed once per screen, so each screen's needs stay visible.
- **Owner** is the API slice that delivers and tests the row: A-02-02 to A-02-07. An A-01 route keeps the A-01 slice that built it, unless a change is needed; the change is then owned by an A-02 slice.
- Each API slice proves its rows with contract tests: every field present with its type, every error and status answered as listed. The UI code slices (A-02-08 to A-02-10) check every row against the built API before they code.
- Never in a response or an error: support reasons in logs, override reasons in audit data, announcement text in logs, phones, tokens (spec, "Money, abuse and privacy").

## Contract

| Screen · state | Route (method, path) | Request fields | Response fields → what they drive | Errors and statuses → screen behaviour | Access | Owner |
|---|---|---|---|---|---|---|

## Routes no screen uses
| Route | Why no screen uses it |
|---|---|

## Existing API met by these screens
Unprofessional or missing answers in A-01 routes that the A-02 screens meet, each with the API slice that fixes it.

| Route | Finding | Fix | Owner |
|---|---|---|---|
