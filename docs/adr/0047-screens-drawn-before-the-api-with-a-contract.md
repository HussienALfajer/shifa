# ADR-0047: Screens are drawn before the API, with a screen-to-API contract; UI code comes last

Status: Accepted (owner, 2026-11-25); the design slice draws on the "Proposals" page of the app's screens canvas, whose other page shows the coded screens, amended by [ADR-0049](0049-screens-canvas-shows-the-coded-screens.md) · Date: 2026-11-25 · Deciders: product owner (with Claude) · Amends: [ADR-0042](0042-screens-drawn-per-ui-batch-with-analysis.md) (when screens are drawn, what the analysis produces), [ADR-0046](0046-full-api-use-and-components-drawn-with-screens.md) (where the route, field and error table is made) · Decision: OD-117

## Context
ADR-0042 has each UI batch draw its screens after the API it uses. A-01 measured the cost. It was planned as eight slices and finished as thirteen. Each drawing round found needs the built API did not serve, and each was closed by a T0 slice of its own: A-01-09 (~3,050 lines), A-01-11 (~3,300), A-01-12 (~3,000), and A-01-13. That is about 9,000 lines of rework, three extra migrations that can never be edited once on `main`, and ten owner decisions (OD-98 to OD-107) taken mid-build. ADR-0042 listed this risk ("a gap found at drawing time can reopen finished API work") and judged it small. It was not small.

ADR-0040 drew every screen in `/spec`, which ADR-0042 replaced because the drawings came weeks before the code, needed one large approval and aged. Two things differ now. The Shifa Design System is complete enough to draw with (Phase 0.4 and the A-01 components). And this ADR draws right before the API, not at spec time, and turns the drawings into a contract the API is built and tested against.

## Decision
- **Spec:** unchanged. `/spec` lists the screens in words with every state, data and action (ADR-0042), and groups them by app.
- **A design slice comes first.** The first slice after an approved spec with UI draws **every screen of the spec** before any API is built. Every design rule of ADR-0042 and ADR-0046 applies: Shifa Design System and Shifa Guide only, working prototypes in Play, every inventory state reachable, Arabic RTL, light and dark, the sizes needed, synthetic data. A large set is approved at several checkpoints within the slice (for example one per app). The slice writes no product code.
- **The design slice's analysis produces the contract.** It is written in the slice file and shown to the owner with the drawings:
  1. **Screen-to-API contract table:** for every screen and state, the route (method and path, existing or planned), the request fields, the response fields shown or driving a state, the error codes and statuses with what the screen does with each, and the permission. Every route the spec implies appears, or is named with the reason no screen uses it. It also lists what is unprofessional in the existing API that the screens meet (ADR-0046).
  2. **Spec gaps:** recorded and added to the spec.
  3. **Improvements:** each with what it adds to the API, a component and the screens, its estimated lines and the slice that would carry it. The owner accepts or declines each one. Accepted ones are drawn and added to the spec as numbered criteria. Declined ones are listed. Only what the owner accepts goes into scope; there is no "every possible improvement".
  4. **Missing components:** drawn on their own sheet with every state and at once on their screens (ADR-0046), approved with the screens.
- **The plan is fixed after approval.** `/slice-plan` re-estimates the backend and UI slices with the accepted improvements and the contract. The owner sees the final slice count, and the reason for any change, before building starts.
- **API slices deliver the contract.** Each backend slice names the contract rows it delivers. Contract tests prove every field, error and status of those rows, and a slice is not done until they pass. A change forced during the build (a review or security finding, a technical limit) updates the contract row and the drawing in the same slice and is reported to the owner. It never becomes a client workaround. A new slice is opened only with the owner's agreement.
- **UI code slices come last, on the finished API.** They are split by the size budget (ADR-0032), never forced into one. Each starts with a short check of the approved drawings and the contract against the built API. A mismatch is fixed in the API and is not redrawn, unless the owner agrees to a change. Then the approved missing components are built with `/ui-component` and synced, and then the screens. Screenshots against the real backend are compared with the approved drawings (ADR-0040). A design-system release between drawing and code is applied to the drawings at that check.
- **Scope:** from A-02 on. Finished A-01 work is not redrawn.

## Consequences
+ API gaps are found before the API exists, so the slices that closed them in A-01 (and their migrations) are not needed.
+ The API is built and tested against a known consumer. Contract tests make "the screen needs X" a failing test, not a late discovery.
+ The owner takes decisions and sees the product's look before the build, and knows the final slice count early.
+ Improvements carry a cost before they are accepted, so scope stays in the owner's hands.
− One larger approval at the start, which takes more of the owner's time than one batch.
− Drawings can still need small corrections when a review changes behaviour. These are bounded by the rule above and made in the same slice.
− The screens ship at the end of the feature, not batch by batch.

## Alternatives considered
- Keep ADR-0042 (draw after the API): measured in A-01 at five slices more than planned, among them three T0 gap slices with about 9,000 lines of rework. Rejected by the owner.
- Return to ADR-0040 (draw in `/spec`): drawings weeks before the code and no contract to build against. Rejected.
- Build all UI code of a feature in one slice: about 10,000 lines for A-02, two and a half times the budget, too large for one session and one review. Rejected.
- Put every improvement that can be imagined into the drawings: grows T0 scope without the owner seeing the cost. Rejected in favour of improvements with costs, accepted one by one.
