# ADR-0048: The components canvas holds the coded components, with a Proposals page

Status: Accepted (owner, 2026-11-25) · Date: 2026-11-25 · Deciders: product owner (with Claude) · Amends: [ADR-0040](0040-design-first-in-claude-design-code-as-source.md), [ADR-0046](0046-full-api-use-and-components-drawn-with-screens.md) · Closes: OD-118

## Context
ADR-0040 made "Shifa Components (proposals)" the canvas where a batch of components is drawn before it is coded, one page per batch, and ADR-0046 kept it for component-only batches. After Phase 0.4 every batch on it was coded and synced, so its seven pages were superseded drawings, some of them (the Flutter page) with no counterpart in the design system.

On 2026-11-25 the owner renamed the canvas "Shifa Components", deleted the seven pages and asked for one sheet per component of the Shifa Design System, every state shown and working in Play, built from the same code.

## Decision
- **"Shifa Components" shows the coded components.** Page "Shifa Components" holds one sheet per public web component: every variant, size and state in Arabic RTL, light and dark, comfortable and compact, each copy the real component mounted from the system's bundle (`Shifa.<Name>`). Hover, pressed and focus copies use the bundle's own CSS rules switched on by a frame (`support/states.css`, generated from `bundle.css`). Modals and toasts, which cover their frame, get open views on boards beside the sheet. The canvas holds the same copy of the system as the Design System artifact and is rebuilt after each sync. A Flutter page shows the patient-app widgets of `packages/shifa_ui` from their own code.
- **A "Proposals" page holds sheets waiting for approval.** A component-only batch (no screens) draws its sheet there. Once the component is coded and synced, its proposal sheet is deleted and its sheet on the component page is built from the bundle.
- **Batches with screens are unchanged:** a missing component is drawn beside its screens (ADR-0046, ADR-0047).

## Consequences
+ One place shows every component as the code renders it today, and it works in Play.
+ Approved proposals do not pile up as stale drawings next to the real components.
− The canvas must be rebuilt after each design-system sync, or its copy falls behind the code.
− An approved proposal sheet is deleted after the sync; the approval date stays in the slice file.

## Alternatives considered
- Keep superseded proposal pages marked "superseded" (the old practice): stale drawings next to real ones. Rejected by the owner.
- Draw component-only proposals on a separate canvas: one more artifact to keep with a design-system copy. Rejected in favour of a page on this canvas.
