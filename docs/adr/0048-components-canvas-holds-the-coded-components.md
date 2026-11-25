# ADR-0048: The components canvas holds the coded components, with a Proposals page

Status: Accepted (owner, 2026-11-25) · Date: 2026-11-25 · Deciders: product owner (with Claude) · Amends: [ADR-0040](0040-design-first-in-claude-design-code-as-source.md), [ADR-0046](0046-full-api-use-and-components-drawn-with-screens.md) · Closes: OD-118

## Context
ADR-0040 made "Shifa Components (proposals)" the canvas where a batch of components is drawn before it is coded, one page per batch, and ADR-0046 kept it for component-only batches. After Phase 0.4 every batch on it was coded and synced, so its seven pages were superseded drawings, some of them (the Flutter page) with no counterpart in the design system.

On 2026-11-25 the owner renamed the canvas "Shifa Components", deleted the seven pages and asked for one sheet per component of the Shifa Design System, every state shown and working in Play, built from the same code.

## Decision
- **"Shifa Components" shows the coded components.** Page "Shifa Components" holds one board per public web component (the owner, 2026-11-25): on top a playground, one live copy whose main props are chosen in the canvas's Tweaks panel; below, every variant, size and state together in one panel. Tweaks also choose the theme (light, dark), the density (comfortable, compact; not for a component without compact values) and the direction (Arabic right to left, English left to right) of the whole board, and, for an overlay, its view: the sheet or one of its open views (a modal or a toast covers its board). Every copy is the real component mounted from the system's bundle (`Shifa.<Name>`). Hover, pressed and focus copies use the bundle's own CSS rules switched on by a frame (`support/states.css`, generated from `bundle.css`). A first layout of four panels per sheet and separate open-view boards (60 boards) was replaced the same day. The canvas holds the same copy of the system as the Design System artifact and is rebuilt after each sync by `packages/ui/scripts/design-system/canvas/` (`components:check`, then `components:canvas`). A Flutter page will show the patient-app widgets of `packages/shifa_ui` from their own code, compiled for the web and mounted in the artboard; it waits for the first patient-app screen slice (owner, 2026-11-25). A trial with ShifaButton worked locally, but the canvas refuses the renderer's `.wasm` file from an account invited from outside its organization, so that slice needs an account in the owning organization, or a canvas that account owns, before it starts.
- **A "Proposals" page holds sheets waiting for approval.** A component-only batch (no screens) draws its sheet there. Once the component is coded and synced, its proposal sheet is deleted and its sheet on the component page is built from the bundle.
- **Batches with screens are unchanged:** a missing component is drawn beside its screens (ADR-0046, ADR-0047).

## Consequences
+ One place shows every component as the code renders it today, and it works in Play.
+ Approved proposals do not pile up as stale drawings next to the real components.
− The canvas must be rebuilt after each design-system sync, or its copy falls behind the code.
− An approved proposal sheet is deleted after the sync; the approval date stays in the slice file.
− Until the patient app's first screen slice, the Flutter widgets are shown only by their golden images in the repository.

## Alternatives considered
- Keep superseded proposal pages marked "superseded" (the old practice): stale drawings next to real ones. Rejected by the owner.
- Draw component-only proposals on a separate canvas: one more artifact to keep with a design-system copy. Rejected in favour of a page on this canvas.
